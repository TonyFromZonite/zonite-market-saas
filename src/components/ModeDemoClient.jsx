import React, { useState } from "react";
import { X, Download, Copy, Check, Share2 } from "lucide-react";
import { addWatermark, blobToFile } from "@/lib/watermark";
import { useToast } from "@/components/ui/use-toast";
import ShareProductModal from "@/components/vendor/ShareProductModal";
import { getVendeurSession } from "@/components/useSessionGuard";

const WhatsAppIcon = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

export default function ModeDemoClient({ produit, onClose }) {
  const [currentImage, setCurrentImage] = useState(0);
  const [downloading, setDownloading] = useState({});
  const [sharing, setSharing] = useState({});
  const [copied, setCopied] = useState(false);
  const [showSharePanel, setShowSharePanel] = useState(false);
  const { toast } = useToast();
  const images = produit?.images || [];

  if (!produit) return null;

  const openWhatsApp = (text) => {
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

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
        toast({ title: '✅ Image téléchargée !' });
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
      openWhatsApp(shareText);
    } catch (error) {
      if (error.name !== 'AbortError') {
        openWhatsApp(shareText);
      }
    } finally {
      setSharing(prev => ({ ...prev, [idx]: false }));
    }
  };

  const shareText =
    `🛍️ *${produit.nom}*\n\n` +
    `${(produit.description || '').slice(0, 150)}\n\n` +
    `✅ Disponible maintenant !\n📦 Livraison à domicile\n📞 Contactez-moi pour commander !\n\n` +
    `_Vendeur officiel ZONITE Market 🇨🇲_`;

  const shareLink = `https://zonite.org`;

  const handleCopyLink = () => {
    const fullText = `${shareText}\n\n👉 ${shareLink}`;
    navigator.clipboard?.writeText(fullText);
    setCopied(true);
    toast({ title: '✅ Lien copié !' });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareNative = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: produit.nom, text: shareText, url: shareLink });
        return;
      } catch {}
    }
    handleCopyLink();
  };

  const handleShareWhatsApp = () => {
    openWhatsApp(`${shareText}\n\n👉 ${shareLink}`);
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
                    <WhatsAppIcon className="w-4 h-4" />
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
                openWhatsApp(msg);
              }}
              className="w-full mt-2 py-3 rounded-xl border-none text-white text-sm font-bold cursor-pointer flex items-center justify-center gap-2"
              style={{ background: "#25D366" }}
            >
              <WhatsAppIcon className="w-5 h-5" />
              Partager la vidéo sur WhatsApp
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

        {/* Share Panel */}
        <div className="space-y-2">
          <button
            onClick={() => setShowSharePanel(true)}
            className="w-full py-3.5 rounded-xl border-none text-white font-bold text-sm cursor-pointer flex items-center justify-center gap-2 active:scale-[0.97] transition-transform"
            style={{ background: "linear-gradient(135deg, #f5a623, #e8940f)", boxShadow: "0 4px 15px rgba(245,166,35,0.4)" }}
          >
            <Share2 className="w-5 h-5" />
            Partager ce produit
          </button>
          {showSharePanel && (
            <ShareProductModal
              produit={produit}
              seller={getVendeurSession()}
              onClose={() => setShowSharePanel(false)}
            />
          )}
        </div>

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
