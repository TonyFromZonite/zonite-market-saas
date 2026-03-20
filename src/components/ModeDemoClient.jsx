import React, { useState } from "react";
import { X, Download, Share2 } from "lucide-react";
import { addWatermark, blobToFile } from "@/lib/watermark";
import { useToast } from "@/components/ui/use-toast";

export default function ModeDemoClient({ produit, onClose }) {
  const [currentImage, setCurrentImage] = useState(0);
  const [downloading, setDownloading] = useState({});
  const [sharing, setSharing] = useState({});
  const { toast } = useToast();
  const images = produit?.images || [];

  if (!produit) return null;

  const handleDownload = async (imageUrl, idx) => {
    setDownloading(prev => ({ ...prev, [idx]: true }));
    try {
      const blob = await addWatermark(imageUrl);
      if (blob) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${produit.nom.replace(/\s+/g, '_')}_ZONITE_${idx + 1}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast({ title: '✅ Image téléchargée !', description: 'Logo ZONITE Market ajouté' });
      } else {
        window.open(imageUrl, '_blank');
      }
    } catch {
      toast({ title: '❌ Erreur', description: 'Impossible de télécharger', variant: 'destructive' });
    } finally {
      setDownloading(prev => ({ ...prev, [idx]: false }));
    }
  };

  const handleShareImage = async (imageUrl, idx) => {
    setSharing(prev => ({ ...prev, [idx]: true }));
    const shareText =
      `🛍️ *${produit.nom}*\n\n` +
      `${(produit.description || '').slice(0, 120)}\n\n` +
      `✅ Disponible maintenant !\n📦 Livraison à domicile\n📞 Contactez-moi pour commander !\n\n` +
      `_Vendeur officiel ZONITE Market 🇨🇲_`;
    try {
      const blob = await addWatermark(imageUrl);
      if (blob && navigator.share && navigator.canShare) {
        const file = blobToFile(blob, `${produit.nom.replace(/\s+/g, '_')}_ZONITE.jpg`);
        const shareData = { title: produit.nom, text: shareText, files: [file] };
        if (navigator.canShare(shareData)) {
          await navigator.share(shareData);
          return;
        }
      }
      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`, '_blank');
    } catch (error) {
      if (error.name !== 'AbortError') {
        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`, '_blank');
      }
    } finally {
      setSharing(prev => ({ ...prev, [idx]: false }));
    }
  };

  const handleShareAll = async () => {
    const text =
      `🛍️ *${produit.nom}*\n\n` +
      `${(produit.description || '').slice(0, 150)}\n\n` +
      `✅ Disponible maintenant !\n📦 Livraison à domicile\n📞 Contactez-moi pour commander !\n\n` +
      `_Vendeur officiel ZONITE Market 🇨🇲_`;
    if (navigator.share) {
      try { await navigator.share({ title: produit.nom, text, url: 'https://zonite.org' }); return; } catch {}
    }
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  const getEmbedUrl = (url) => {
    if (!url) return null;
    const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
    if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;
    return url;
  };

  return (
    <div className="fixed inset-0 z-[100] bg-[#0a0e2e] flex flex-col overflow-y-auto">
      {/* Header */}
      <div
        className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3 border-b border-white/10"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top, 0px))", background: "rgba(10,14,46,0.95)", backdropFilter: "blur(10px)" }}
      >
        <button onClick={onClose} className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center">
          <X className="w-5 h-5 text-white" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-white font-bold text-sm truncate">{produit.nom}</p>
          <p className="text-amber-400 text-[11px]">Mode démonstration client</p>
        </div>
      </div>

      <div className="px-4 py-4 space-y-5">
        {/* Watermark notice */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <span className="text-base">🏷️</span>
          <p className="text-amber-400/80 text-[11px] leading-snug">
            Le logo ZONITE Market sera ajouté automatiquement sur chaque image téléchargée ou partagée.
          </p>
        </div>

        {/* Product Images */}
        {images.length > 0 && (
          <div>
            <p className="text-amber-400 font-semibold text-xs mb-3">📸 Photos du produit</p>
            {images.map((img, idx) => (
              <div key={idx} className="mb-4">
                <img src={img} alt={`${produit.nom} ${idx + 1}`} className="w-full rounded-xl block" />
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => handleDownload(img, idx)}
                    disabled={downloading[idx]}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-white/10 text-white text-xs font-semibold border-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Download className="w-3.5 h-3.5" />
                    {downloading[idx] ? '⏳ ...' : 'Télécharger'}
                  </button>
                  <button
                    onClick={() => handleShareImage(img, idx)}
                    disabled={sharing[idx]}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg border-none text-white text-xs font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ background: sharing[idx] ? '#1a8a40' : '#25D366' }}
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    {sharing[idx] ? '⏳ ...' : 'Partager'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {images.length === 0 && (
          <div className="text-center py-12 text-white/30">
            <p className="text-5xl mb-3">📦</p>
            <p>Aucune image disponible</p>
          </div>
        )}

        {/* Product Video */}
        {produit.lien_telegram && getEmbedUrl(produit.lien_telegram) && (
          <div>
            <p className="text-amber-400 font-semibold text-xs mb-3">🎬 Vidéo de démonstration</p>
            <div className="relative w-full rounded-xl overflow-hidden bg-black" style={{ paddingBottom: "56.25%" }}>
              <iframe
                src={getEmbedUrl(produit.lien_telegram)}
                className="absolute inset-0 w-full h-full border-none"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
            <button
              onClick={() => {
                const msg = `🎬 *${produit.nom}* - Vidéo démonstration\n\n${(produit.description || '').slice(0, 100)}\n\nVoir la vidéo : ${produit.lien_telegram}\n\nDisponible chez ZONITE Market !`;
                window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, '_blank');
              }}
              className="w-full mt-2 py-3 rounded-xl border-none text-white text-sm font-bold cursor-pointer flex items-center justify-center gap-2"
              style={{ background: "#25D366" }}
            >
              💬 Partager la vidéo sur WhatsApp
            </button>
          </div>
        )}

        {/* Product Info — NO PRICES */}
        <div className="rounded-xl p-4" style={{ background: "rgba(245,166,35,0.08)" }}>
          <h2 className="text-white text-lg font-bold mb-2">{produit.nom}</h2>
          {produit.description && (
            <p className="text-white/70 text-sm leading-relaxed whitespace-pre-line">{produit.description}</p>
          )}
          {(produit.variations || []).length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {produit.variations.map((v, i) => (
                <div key={i} className="flex flex-wrap gap-1.5">
                  {(v.options || []).map(opt => (
                    <span key={opt} className="px-3 py-1 bg-white/10 rounded-full text-xs text-white/80">{opt}</span>
                  ))}
                </div>
              ))}
            </div>
          )}
          <div className="mt-3">
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${(produit.stock_global || 0) > 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
              {(produit.stock_global || 0) > 0 ? '✅ Disponible' : '❌ Indisponible'}
            </span>
          </div>
        </div>

        {/* Share All */}
        <button
          onClick={handleShareAll}
          className="w-full py-3.5 rounded-xl border-none text-white font-bold text-sm cursor-pointer flex items-center justify-center gap-2 active:scale-[0.97] transition-transform"
          style={{ background: "linear-gradient(135deg, #f5a623, #e8940f)", boxShadow: "0 4px 15px rgba(245,166,35,0.4)" }}
        >
          📤 Partager ce produit
        </button>

        {/* Branding */}
        <div className="text-center py-3 border-t border-white/5">
          <p className="text-white/20 text-[11px]">Produit certifié</p>
          <p className="text-amber-400 font-bold text-sm mt-0.5">ZONITE Market 🇨🇲</p>
          <p className="text-white/20 text-[10px] mt-0.5">Livraison rapide partout au Cameroun</p>
        </div>
      </div>
    </div>
  );
}
