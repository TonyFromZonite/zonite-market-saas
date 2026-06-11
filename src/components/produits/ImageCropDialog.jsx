import React, { useCallback, useEffect, useMemo, useState } from "react";
import Cropper from "react-easy-crop";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Square, RectangleHorizontal, RectangleVertical, Maximize2 } from "lucide-react";

const RATIOS = [
  { id: "free", label: "Libre", value: null, Icon: Maximize2 },
  { id: "1", label: "1:1", value: 1, Icon: Square },
  { id: "4_3", label: "4:3", value: 4 / 3, Icon: RectangleHorizontal },
  { id: "3_4", label: "3:4", value: 3 / 4, Icon: RectangleVertical },
];

const PREFS_KEY = "zonite_crop_prefs_v1";
const ZOOM_MIN = 1;
const ZOOM_MAX = 4;
const ZOOM_DEFAULT = 1;
const ASPECT_DEFAULT = null;
const ALLOWED_ASPECTS = RATIOS.map((r) => r.value); // [null, 1, 4/3, 3/4]

function sanitizeZoom(z) {
  const n = typeof z === "number" ? z : Number(z);
  if (!Number.isFinite(n)) return ZOOM_DEFAULT;
  if (n < ZOOM_MIN) return ZOOM_MIN;
  if (n > ZOOM_MAX) return ZOOM_MAX;
  return n;
}

function sanitizeAspect(a) {
  if (a === null || a === undefined) return ASPECT_DEFAULT;
  const n = typeof a === "number" ? a : Number(a);
  if (!Number.isFinite(n) || n <= 0) return ASPECT_DEFAULT;
  // Snap aux ratios connus, sinon fallback à Libre
  const match = ALLOWED_ASPECTS.find(
    (v) => v !== null && Math.abs(v - n) < 0.001
  );
  return match ?? ASPECT_DEFAULT;
}

function loadPrefs() {
  const fallback = { zoom: ZOOM_DEFAULT, aspect: ASPECT_DEFAULT };
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return fallback;
    const p = JSON.parse(raw);
    if (typeof p !== "object" || p === null) {
      try { localStorage.removeItem(PREFS_KEY); } catch { /* ignore */ }
      return fallback;
    }
    return {
      zoom: sanitizeZoom(p.zoom),
      aspect: sanitizeAspect(p.aspect),
    };
  } catch {
    try { localStorage.removeItem(PREFS_KEY); } catch { /* ignore */ }
    return fallback;
  }
}

function savePrefs(prefs) {
  try {
    const safe = {
      zoom: sanitizeZoom(prefs?.zoom),
      aspect: sanitizeAspect(prefs?.aspect),
    };
    localStorage.setItem(PREFS_KEY, JSON.stringify(safe));
  } catch {
    // ignore
  }
}

async function cropToBlob(imageSrc, areaPx, mime = "image/jpeg") {
  const img = await new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = imageSrc;
  });
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(areaPx.width);
  canvas.height = Math.round(areaPx.height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(
    img,
    areaPx.x, areaPx.y, areaPx.width, areaPx.height,
    0, 0, areaPx.width, areaPx.height
  );
  return await new Promise((r) => canvas.toBlob(r, mime, 0.95));
}

/**
 * Lit le fichier en data URL. Si HEIC, convertit d'abord en JPEG via heic2any
 * pour que <img> du cropper puisse l'afficher.
 */
async function fileToPreviewUrl(file) {
  const isHeic = /\.(heic|heif)$/i.test(file.name || "") ||
                 /heic|heif/i.test(file.type || "");
  if (isHeic) {
    try {
      const heic2any = (await import("heic2any")).default;
      const blob = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 });
      const out = Array.isArray(blob) ? blob[0] : blob;
      return { url: URL.createObjectURL(out), mime: "image/jpeg" };
    } catch {
      // fallback : on tente quand même le décodage natif
    }
  }
  return { url: URL.createObjectURL(file), mime: file.type || "image/jpeg" };
}

export default function ImageCropDialog({ open, file, onCancel, onConfirm }) {
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewMime, setPreviewMime] = useState("image/jpeg");
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const initialPrefs = useMemo(() => loadPrefs(), []);
  const [zoom, setZoom] = useState(() => sanitizeZoom(initialPrefs.zoom));
  const [aspect, setAspect] = useState(() => sanitizeAspect(initialPrefs.aspect));
  const [areaPx, setAreaPx] = useState(null);
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    if (!open || !file) return;
    let cancelled = false;
    let urlToRevoke = null;
    setLoading(true);
    setCrop({ x: 0, y: 0 });
    // keep zoom & aspect from saved prefs across uploads
    setAreaPx(null);
    (async () => {
      try {
        const { url, mime } = await fileToPreviewUrl(file);
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        urlToRevoke = url;
        setPreviewUrl(url);
        setPreviewMime(mime);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      if (urlToRevoke) URL.revokeObjectURL(urlToRevoke);
      setPreviewUrl(null);
    };
  }, [open, file]);

  const onCropComplete = useCallback((_area, areaPixels) => {
    setAreaPx(areaPixels);
  }, []);

  const handleConfirm = async () => {
    if (!previewUrl || !areaPx) return;
    setWorking(true);
    try {
      const blob = await cropToBlob(previewUrl, areaPx, "image/jpeg");
      if (!blob) return;
      savePrefs({ aspect: aspect ?? null, zoom });
      const baseName = (file?.name || "image").replace(/\.[a-z0-9]+$/i, "");
      const cropped = new File([blob], `${baseName}_crop.jpg`, { type: "image/jpeg" });
      onConfirm(cropped);
    } finally {
      setWorking(false);
    }
  };

  const useOriginal = () => {
    if (file) onConfirm(file);
  };

  const ratioButtons = useMemo(() => RATIOS, []);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !working && onCancel?.()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Recadrer l'image</DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap gap-2">
          {ratioButtons.map(({ id, label, value, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setAspect(sanitizeAspect(value))}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs border transition ${
                aspect === value
                  ? "bg-[#1a1f5e] text-white border-[#1a1f5e]"
                  : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        <div className="relative w-full bg-slate-900 rounded-lg overflow-hidden" style={{ height: 380 }}>
          {loading || !previewUrl ? (
            <div className="absolute inset-0 flex items-center justify-center text-slate-300">
              <Loader2 className="w-6 h-6 animate-spin mr-2" /> Préparation…
            </div>
          ) : (
            <Cropper
              image={previewUrl}
              crop={crop}
              zoom={zoom}
              aspect={aspect ?? undefined}
              onCropChange={setCrop}
              onZoomChange={(z) => setZoom(sanitizeZoom(z))}
              onCropComplete={onCropComplete}
              restrictPosition={false}
              objectFit="contain"
            />
          )}
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500 w-16">Zoom</span>
          <input
            type="range"
            min={1}
            max={4}
            step={0.05}
            value={zoom}
            onChange={(e) => setZoom(sanitizeZoom(e.target.value))}
            className="flex-1 accent-[#1a1f5e]"
            disabled={loading || !previewUrl}
          />
          <span className="text-xs text-slate-500 w-10 text-right">{zoom.toFixed(1)}x</span>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="ghost" onClick={onCancel} disabled={working}>
            Annuler
          </Button>
          <Button type="button" variant="outline" onClick={useOriginal} disabled={working || loading}>
            Sans recadrage
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={working || loading || !areaPx}
            className="bg-[#1a1f5e] hover:bg-[#0f1442] text-white"
          >
            {working ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Traitement…</>) : "Valider"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
