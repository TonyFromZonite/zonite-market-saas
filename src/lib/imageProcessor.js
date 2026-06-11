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

async function convertHeicToJpeg(file) {
  // Import dynamique pour ne pas alourdir le bundle initial
  const heic2any = (await import("heic2any")).default;
  try {
    const blob = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 });
    const out = Array.isArray(blob) ? blob[0] : blob;
    const newName = file.name.replace(/\.(heic|heif)$/i, ".jpg") || `image_${Date.now()}.jpg`;
    return new File([out], newName, { type: "image/jpeg" });
  } catch (e) {
    const err = new Error(
      "Impossible de lire ce fichier HEIC. Exportez-le en JPEG depuis votre iPhone (Réglages → Appareil photo → Formats → Plus compatible) puis réessayez."
    );
    err.cause = e;
    throw err;
  }
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

export async function processImageForUpload(file) {
  if (!file) return file;
  // SVG : on ne touche pas
  if ((file.type || "").includes("svg")) return file;

  let working = file;
  if (isHeicFile(file)) {
    working = await convertHeicToJpeg(file);
  }

  // Seulement pour les images bitmap
  if (!/^image\//i.test(working.type)) return working;

  return await resizeAndCompress(working);
}
