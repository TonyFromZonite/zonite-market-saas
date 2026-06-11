/**
 * Normalisation des images avant upload :
 *  - Conversion HEIC/HEIF (iPhone) → JPEG via heic2any (navigateur)
 *  - Redimensionnement à MAX_WIDTH px max via <canvas>
 *  - Compression JPEG qualité JPEG_QUALITY
 *
 * Utilisé par uploadFile() (supabaseHelpers.js) pour toutes les images
 * produits et photo de profil. Les KYC ne passent pas par ici.
 */

const MAX_WIDTH = 1600;
const MAX_HEIGHT = 1600;
const JPEG_QUALITY = 0.85;

function isHeicFile(file) {
  if (!file) return false;
  const name = (file.name || "").toLowerCase();
  const type = (file.type || "").toLowerCase();
  return /\.(heic|heif)$/i.test(name) || type === "image/heic" || type === "image/heif";
}

/**
 * Inspecte les premiers octets d'un HEIC pour identifier la "brand" ISOBMFF
 * (ftyp box). Retourne :
 *   { brand, compatible, isSequence, isLivePhoto, isSupported }
 * - brands single-image :  heic, heix, mif1
 * - brands séquences    :  hevc, hevx, heim, heis, hevm, hevs, msf1
 *   (Live Photos iPhone = souvent "hevc"/"heim"/"hevm" multi-frame)
 */
async function inspectHeicBrand(file) {
  try {
    const head = await file.slice(0, 64).arrayBuffer();
    const bytes = new Uint8Array(head);
    // Cherche la signature "ftyp"
    let ftypIdx = -1;
    for (let i = 0; i <= bytes.length - 8; i++) {
      if (
        bytes[i] === 0x66 && bytes[i + 1] === 0x74 &&
        bytes[i + 2] === 0x79 && bytes[i + 3] === 0x70
      ) { ftypIdx = i; break; }
    }
    if (ftypIdx < 0) return { brand: null, isSupported: false };
    const decoder = new TextDecoder("ascii");
    const brand = decoder.decode(bytes.slice(ftypIdx + 4, ftypIdx + 8)).trim().toLowerCase();
    const compatibles = decoder
      .decode(bytes.slice(ftypIdx + 12, Math.min(ftypIdx + 64, bytes.length)))
      .toLowerCase();
    const sequenceBrands = ["hevc", "hevx", "heim", "heis", "hevm", "hevs", "msf1"];
    const isSequence = sequenceBrands.includes(brand) ||
                       sequenceBrands.some((b) => compatibles.includes(b));
    const isLivePhoto = isSequence; // proxy raisonnable côté iPhone
    const knownStill = ["heic", "heix", "mif1", "heif"];
    const isSupported = knownStill.includes(brand) ||
                        knownStill.some((b) => compatibles.includes(b));
    return { brand, compatible: compatibles, isSequence, isLivePhoto, isSupported };
  } catch {
    return { brand: null, isSupported: false };
  }
}

async function convertHeicToJpeg(file) {
  // Import dynamique pour ne pas alourdir le bundle initial
  let heic2any;
  try {
    heic2any = (await import("heic2any")).default;
  } catch (e) {
    console.error("[imageProcessor] heic2any load failed:", e);
    throw new Error("Module de conversion HEIC indisponible. Vérifiez votre connexion puis réessayez.");
  }

  // Essais successifs : JPEG haute qualité, puis JPEG basique, puis PNG.
  // Certains HEIC (Live Photos, HEVC multi-images) échouent sur le premier essai.
  const attempts = [
    { toType: "image/jpeg", quality: 0.9 },
    { toType: "image/jpeg" },
    { toType: "image/png" },
  ];

  let lastError;
  for (const opts of attempts) {
    try {
      const result = await heic2any({ blob: file, ...opts });
      const out = Array.isArray(result) ? result[0] : result;
      if (!out) continue;
      const ext = opts.toType === "image/png" ? ".png" : ".jpg";
      const newName = (file.name || `image_${Date.now()}`).replace(/\.(heic|heif)$/i, ext);
      return new File([out], newName, { type: opts.toType });
    } catch (e) {
      lastError = e;
      console.warn("[imageProcessor] HEIC attempt failed", opts, e);
    }
  }

  console.error("[imageProcessor] HEIC conversion definitively failed:", lastError);
  const err = new Error(
    "Impossible de lire ce fichier HEIC. Exportez-le en JPEG depuis votre iPhone (Réglages → Appareil photo → Formats → Plus compatible) puis réessayez."
  );
  err.cause = lastError;
  throw err;
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}

async function resizeAndCompress(file) {
  let img;
  try {
    img = await loadImage(file);
  } catch {
    // Fichier illisible par le navigateur — on retourne tel quel
    return file;
  }

  const { width: w0, height: h0 } = img;
  if (!w0 || !h0) return file;

  const ratio = Math.min(MAX_WIDTH / w0, MAX_HEIGHT / h0, 1);
  const w = Math.round(w0 * ratio);
  const h = Math.round(h0 * ratio);

  // Si déjà petit ET déjà JPEG/WebP/PNG raisonnable (<400 Ko), on garde tel quel
  if (ratio === 1 && file.size < 400 * 1024 && /^image\/(jpeg|webp|png)$/i.test(file.type)) {
    return file;
  }

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, w, h);

  const blob = await new Promise((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY)
  );
  if (!blob) return file;

  const baseName = (file.name || "image").replace(/\.[a-z0-9]+$/i, "");
  return new File([blob], `${baseName}.jpg`, { type: "image/jpeg" });
}

async function tryNativeHeicDecode(file) {
  // Safari iOS sait lire les HEIC nativement via <img>. Si ça marche,
  // on ré-encode en JPEG via canvas — pas besoin de heic2any.
  try {
    const img = await loadImage(file);
    if (!img.width || !img.height) return null;
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    canvas.getContext("2d").drawImage(img, 0, 0);
    const blob = await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.9));
    if (!blob) return null;
    const newName = (file.name || `image_${Date.now()}`).replace(/\.(heic|heif)$/i, ".jpg");
    return new File([blob], newName, { type: "image/jpeg" });
  } catch {
    return null;
  }
}

export async function processImageForUpload(file) {
  if (!file) return file;
  // SVG : on ne touche pas
  if ((file.type || "").includes("svg")) return file;

  let working = file;
  if (isHeicFile(file)) {
    const info = await inspectHeicBrand(file);
    // 1) Tentative native (Safari iOS lit le HEIC directement) — pas de lib lourde
    const native = await tryNativeHeicDecode(file);
    if (native) {
      working = native;
    } else {
      // 2) Fallback : conversion via heic2any (Chrome/Firefox/Android)
      try {
        working = await convertHeicToJpeg(file);
      } catch (convErr) {
        // Message adapté selon la "brand" détectée
        if (info?.isLivePhoto || info?.isSequence) {
          const err = new Error(
            "Ce fichier est une Live Photo (HEIC multi-images) non supportée par le navigateur. " +
            "Sur votre iPhone : ouvrez la photo → bouton « Modifier » → « Live » → désactivez Live, " +
            "ou exportez en JPEG (Réglages → Appareil photo → Formats → Plus compatible)."
          );
          err.cause = convErr;
          err.heicBrand = info.brand;
          throw err;
        }
        if (info && info.brand && !info.isSupported) {
          const err = new Error(
            `Format HEIC « ${info.brand} » non reconnu par le navigateur. ` +
            "Exportez le fichier en JPEG depuis votre iPhone (Réglages → Appareil photo → Formats → Plus compatible)."
          );
          err.cause = convErr;
          err.heicBrand = info.brand;
          throw err;
        }
        throw convErr;
      }
    }
  }

  // Seulement pour les images bitmap
  if (!/^image\//i.test(working.type)) return working;

  return await resizeAndCompress(working);
}
