import React, { useState } from "react";
import { X, Copy, Check, Share2 } from "lucide-react";
import { addWatermark, blobToFile } from "@/lib/watermark";
import { useToast } from "@/components/ui/use-toast";

const WhatsAppIcon = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

export default function ShareProductModal({ produit, seller, onClose }) {
  const prixGros = Number(produit?.prix_gros || 0);
  const prixSuggere = Number(produit?.prix_vente || 0);
  const [prixVente, setPrixVente] = useState(prixSuggere);
  const [sharing, setSharing] = useState(false);
  const [selectedImage, setSelectedImage] = useState(produit?.images?.[0] || null);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const images = produit?.images || [];

  const commission = Math.max(0, prixVente - prixGros);
  const isValid = prixVente > prixGros;

  const buildMessage = () => {
    const lines = [
      `🛍️ *${produit.nom}*`,
      "",
      produit.description ? produit.description.slice(0, 150) : "",
      "",
      `💰 Prix : *${Number(prixVente).toLocaleString("fr-FR")} FCFA*`,
      `✅ Disponible maintenant !`,
      `📦 Livraison rapide à domicile`,
      "",
      `📞 Pour commander :`,
      `*${seller?.full_name || "Votre vendeur ZONITE"}*`,
    ];
    if (seller?.whatsapp || seller?.telephone) {
      lines.push(`📱 ${seller.whatsapp || seller.telephone}`);
    }
    lines.push("", "_Vendeur certifié ZONITE Market 🇨🇲_");
    return lines.join("\n");
  };

  const shareWithImage = async (waOnly = false) => {
    setSharing(true);
    try {
      const message = buildMessage();

      // Try Web Share API with image file
      // iOS WhatsApp drops text when sharing files, so we copy text to clipboard first
      if (selectedImage && navigator.share && navigator.canShare) {
        try {
          const blob = await addWatermark(selectedImage);
          if (blob) {
            const file = blobToFile(blob, `${produit.nom.replace(/\s+/g, "_")}_ZONITE.jpg`);
            const shareData = { files: [file], text: message };
            if (navigator.canShare(shareData)) {
              // Pre-copy text to clipboard for iOS WhatsApp compatibility
              try { await navigator.clipboard.writeText(message); } catch {}
              toast({
                title: "📋 Texte copié !",
                description: "Si le texte n'apparaît pas, collez-le dans le message.",
              });
              await navigator.share(shareData);
              onClose();
              return;
            }
          }
        } catch (err) {
          if (err.name === "AbortError") { setSharing(false); return; }
        }
      }

      // Fallback: WhatsApp URL (text only, no image via URL)
      if (waOnly) {
        window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank");
        onClose();
        return;
      }

      // Fallback: native share text only
      if (navigator.share) {
        try {
          await navigator.share({ title: produit.nom, text: message });
          onClose();
          return;
        } catch (err) {
          if (err.name === "AbortError") { setSharing(false); return; }
        }
      }

      // Last fallback: copy
      navigator.clipboard?.writeText(message);
      toast({ title: "✅ Texte copié !" });
    } catch {
      toast({ title: "❌ Erreur de partage", variant: "destructive" });
    } finally {
      setSharing(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard?.writeText(buildMessage());
    setCopied(true);
    toast({ title: "✅ Texte copié !" });
    setTimeout(() => setCopied(false), 2000);
  };

  const quickPrices = [prixGros + 500, prixGros + 1000, prixGros + 2000, prixGros + 3000, prixSuggere]
    .filter((p, i, arr) => arr.indexOf(p) === i && p > prixGros)
    .sort((a, b) => a - b);

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative w-full max-w-md max-h-[92vh] overflow-y-auto rounded-t-2xl"
        style={{ background: "#0f1340" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        <div className="px-4 pb-6 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <p className="text-white font-bold text-base">📤 Partager ce produit</p>
            <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center border-none cursor-pointer">
              <X className="w-4 h-4 text-white/60" />
            </button>
          </div>

          {/* Product preview */}
          <div className="flex gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
            {selectedImage && (
              <img src={selectedImage} alt="" className="w-16 h-16 rounded-lg object-cover shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-white font-semibold text-sm truncate">{produit.nom}</p>
              <p className="text-white/50 text-xs mt-1">
                Prix de gros : <span className="text-amber-400 font-semibold">{prixGros.toLocaleString("fr-FR")} FCFA</span>
              </p>
            </div>
          </div>

          {/* Image selector */}
          {images.length > 1 && (
            <div>
              <p className="text-white/60 text-xs font-medium mb-2">Photo à partager :</p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {images.map((img, i) => (
                  <img
                    key={i}
                    src={img}
                    alt=""
                    onClick={() => setSelectedImage(img)}
                    className="w-14 h-14 rounded-lg object-cover shrink-0 cursor-pointer transition-all"
                    style={{
                      border: selectedImage === img ? "2px solid #f5a623" : "2px solid transparent",
                      opacity: selectedImage === img ? 1 : 0.5,
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Custom price */}
          <div className="p-3 rounded-xl border border-white/10" style={{ background: "rgba(245,166,35,0.06)" }}>
            <p className="text-amber-400 font-semibold text-xs mb-2">💰 Mon prix de vente</p>
            <div className="relative">
              <input
                type="number"
                value={prixVente}
                onChange={(e) => setPrixVente(Number(e.target.value))}
                min={prixGros + 1}
                className="w-full py-3 px-4 pr-16 rounded-lg text-white text-xl font-bold text-center border-none outline-none"
                style={{
                  background: "#0a0e2e",
                  border: `2px solid ${isValid ? "#22c55e" : "#ef4444"}`,
                  borderRadius: "10px",
                }}
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 text-sm font-semibold">FCFA</span>
            </div>

            {/* Quick prices */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {quickPrices.map((price) => (
                <button
                  key={price}
                  onClick={() => setPrixVente(price)}
                  className="border-none cursor-pointer text-xs font-semibold px-2.5 py-1 rounded-full transition-colors"
                  style={{
                    background: prixVente === price ? "#f5a623" : "rgba(255,255,255,0.1)",
                    color: prixVente === price ? "#0a0e2e" : "rgba(255,255,255,0.6)",
                  }}
                >
                  {price.toLocaleString("fr-FR")} F
                </button>
              ))}
            </div>

            {/* Commission */}
            <div
              className="flex items-center justify-between mt-3 px-3 py-2 rounded-lg"
              style={{
                background: isValid ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
                border: `1px solid ${isValid ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)"}`,
              }}
            >
              <span className="text-white/60 text-xs">Votre commission :</span>
              <span className="font-bold text-sm" style={{ color: isValid ? "#22c55e" : "#ef4444" }}>
                {isValid ? `+${commission.toLocaleString("fr-FR")} FCFA` : "Prix trop bas !"}
              </span>
            </div>
          </div>

          {/* Message preview */}
          <div className="p-3 rounded-xl bg-white/5 border border-white/10">
            <p className="text-white/40 text-[10px] font-medium mb-1">Aperçu du message :</p>
            <p className="text-white/70 text-xs whitespace-pre-line leading-relaxed">{buildMessage().slice(0, 200)}...</p>
          </div>

          {/* Share buttons */}
          <div className="space-y-2">
            {/* WhatsApp */}
            <button
              onClick={() => shareWithImage(true)}
              disabled={!isValid || sharing}
              className="w-full py-3.5 rounded-xl border-none text-white font-bold text-sm cursor-pointer flex items-center justify-center gap-2.5 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.97] transition-transform"
              style={{ background: isValid ? "#25D366" : "rgba(255,255,255,0.1)" }}
            >
              {sharing ? (
                <span className="inline-block w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <WhatsAppIcon className="w-5 h-5" />
              )}
              {sharing ? "Préparation..." : "Envoyer sur WhatsApp + Photo"}
            </button>

            {/* Other networks */}
            <button
              onClick={() => shareWithImage(false)}
              disabled={!isValid || sharing}
              className="w-full py-3 rounded-xl border border-white/15 text-white font-semibold text-sm cursor-pointer flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.97] transition-transform"
              style={{ background: "rgba(255,255,255,0.06)" }}
            >
              <Share2 className="w-4 h-4" />
              Partager sur autres réseaux
            </button>

            {/* Copy text */}
            <button
              onClick={handleCopy}
              className="w-full py-3 rounded-xl border border-amber-500/20 text-amber-400 text-sm font-semibold cursor-pointer flex items-center justify-center gap-2 active:scale-[0.97] transition-transform"
              style={{ background: "rgba(245,166,35,0.08)" }}
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? "Copié !" : "Copier le texte seulement"}
            </button>
          </div>

          <p className="text-white/30 text-[10px] text-center">Le logo ZONITE Market sera ajouté sur la photo</p>
        </div>
      </div>
    </div>
  );
}
