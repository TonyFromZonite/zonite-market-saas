/**
 * Audit 23 — processImageForUpload (gestion HEIC)
 *
 * Couvre :
 *  - HEIC standard (brand "heic") : conversion réussie via heic2any
 *  - HEIC multi-frame / Live Photo (brand "hevc") : message d'erreur dédié
 *  - HEIC corrompu / sans box ftyp : message générique d'erreur HEIC
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// --- Mock dynamique de heic2any (chargé via import("heic2any")) ---
const heic2anyMock = vi.fn();
vi.mock("heic2any", () => ({ default: (...args: unknown[]) => heic2anyMock(...args) }));

// Utilitaire : construit un File HEIC fictif avec une box ftyp + brand donnée
function makeHeicFile(brand: string, name = "photo.heic"): File {
  // Header: 4 bytes size (0) + "ftyp" + brand(4) + version(4) + compatible brands
  const enc = new TextEncoder();
  const ftyp = enc.encode("ftyp");
  const brandBytes = enc.encode((brand + "    ").slice(0, 4));
  const version = new Uint8Array([0, 0, 0, 0]);
  const compatible = enc.encode("mif1heic");
  const buf = new Uint8Array(4 + ftyp.length + brandBytes.length + version.length + compatible.length);
  let o = 4;
  buf.set(ftyp, o); o += ftyp.length;
  buf.set(brandBytes, o); o += brandBytes.length;
  buf.set(version, o); o += version.length;
  buf.set(compatible, o);
  return new File([buf], name, { type: "image/heic" });
}

function makeCorruptHeicFile(): File {
  // Aucun "ftyp" → inspector renvoie isSupported=false sans brand
  return new File([new Uint8Array([0xff, 0xd8, 0x00, 0x00, 0x12, 0x34])], "broken.heic", {
    type: "image/heic",
  });
}

describe("Audit 23 — processImageForUpload (HEIC)", () => {
  beforeEach(() => {
    heic2anyMock.mockReset();

    // URL.createObjectURL / revokeObjectURL stubs
    // @ts-expect-error jsdom
    global.URL.createObjectURL = vi.fn(() => "blob:mock");
    // @ts-expect-error jsdom
    global.URL.revokeObjectURL = vi.fn();

    // Force échec du décodage natif (jsdom ne décode pas le HEIC de toute façon)
    // On simule img.onerror pour tryNativeHeicDecode + loadImage
    const OriginalImage = global.Image;
    class FailingImage {
      onload: (() => void) | null = null;
      onerror: ((e: unknown) => void) | null = null;
      width = 0;
      height = 0;
      set src(_v: string) {
        queueMicrotask(() => this.onerror?.(new Error("decode failed")));
      }
    }
    // @ts-expect-error override
    global.Image = FailingImage;
    // restore au teardown
    (global as unknown as { __OriginalImage: typeof Image }).__OriginalImage = OriginalImage;
  });

  afterEach(() => {
    // @ts-expect-error restore
    global.Image = (global as unknown as { __OriginalImage: typeof Image }).__OriginalImage;
  });

  it("23.1 HEIC standard (brand 'heic') : conversion via heic2any réussit", async () => {
    // heic2any retourne un blob JPEG simulé
    heic2anyMock.mockResolvedValueOnce(new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: "image/jpeg" }));

    const { processImageForUpload } = await import("@/lib/imageProcessor");
    const file = makeHeicFile("heic", "iphone.heic");

    const out = await processImageForUpload(file);

    expect(heic2anyMock).toHaveBeenCalled();
    expect(out).toBeInstanceOf(File);
    // Après conversion HEIC, le nom doit se terminer par .jpg
    expect(out.name.toLowerCase()).toMatch(/\.jpg$/);
  });

  it("23.2 HEIC multi-frame / Live Photo (brand 'hevc') : message dédié si heic2any échoue", async () => {
    heic2anyMock.mockRejectedValue(new Error("ERR_LIBHEIF format not supported"));

    const { processImageForUpload } = await import("@/lib/imageProcessor");
    const file = makeHeicFile("hevc", "live.heic");

    await expect(processImageForUpload(file)).rejects.toThrow(/Live Photo|multi-images/i);
  });

  it("23.3 HEIC corrompu (pas de ftyp) : message HEIC générique", async () => {
    heic2anyMock.mockRejectedValue(new Error("invalid input"));

    const { processImageForUpload } = await import("@/lib/imageProcessor");
    const file = makeCorruptHeicFile();

    await expect(processImageForUpload(file)).rejects.toThrow(/HEIC/i);
  });

  it("23.4 Fichier non-HEIC : ne passe pas par heic2any", async () => {
    const { processImageForUpload } = await import("@/lib/imageProcessor");
    const jpg = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], "photo.jpg", { type: "image/jpeg" });

    const out = await processImageForUpload(jpg);
    expect(heic2anyMock).not.toHaveBeenCalled();
    expect(out).toBeInstanceOf(File);
  });
});
