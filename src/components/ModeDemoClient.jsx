import React, { useState } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

export default function ModeDemoClient({ produit, onClose }) {
  const [currentImage, setCurrentImage] = useState(0);
  const images = produit?.images || [];

  if (!produit) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/80 text-white" style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top, 0px))" }}>
        <span className="text-xs text-white/50">Mode Démonstration</span>
        <button onClick={onClose} className="p-1">
          <X className="w-6 h-6 text-white" />
        </button>
      </div>

      {/* Image */}
      <div className="flex-1 relative flex items-center justify-center bg-black">
        {images.length > 0 ? (
          <>
            <img
              src={images[currentImage]}
              alt={produit.nom}
              className="max-w-full max-h-full object-contain"
            />
            {images.length > 1 && (
              <>
                <button
                  onClick={() => setCurrentImage(i => i > 0 ? i - 1 : images.length - 1)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/20 flex items-center justify-center"
                >
                  <ChevronLeft className="w-5 h-5 text-white" />
                </button>
                <button
                  onClick={() => setCurrentImage(i => i < images.length - 1 ? i + 1 : 0)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/20 flex items-center justify-center"
                >
                  <ChevronRight className="w-5 h-5 text-white" />
                </button>
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                  {images.map((_, i) => (
                    <div key={i} className={`w-2 h-2 rounded-full ${i === currentImage ? 'bg-white' : 'bg-white/30'}`} />
                  ))}
                </div>
              </>
            )}
          </>
        ) : (
          <div className="text-white/30 text-center">
            <p className="text-6xl mb-4">📦</p>
            <p>Aucune image disponible</p>
          </div>
        )}
      </div>

      {/* Product info — NO PRICES */}
      <div className="bg-gradient-to-t from-black via-black/90 to-transparent px-4 py-5">
        <h2 className="text-white text-xl font-bold mb-1">{produit.nom}</h2>
        {produit.description && (
          <p className="text-white/60 text-sm leading-relaxed line-clamp-3">{produit.description}</p>
        )}
        {(produit.variations || []).length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {produit.variations.map((v, i) => (
              <div key={i} className="flex flex-wrap gap-1.5">
                {(v.options || []).map(opt => (
                  <span key={opt} className="px-3 py-1 bg-white/10 rounded-full text-xs text-white/80">{opt}</span>
                ))}
              </div>
            ))}
          </div>
        )}
        <div className="mt-3 flex items-center gap-2">
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${(produit.stock_global || 0) > 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
            {(produit.stock_global || 0) > 0 ? '✅ Disponible' : '❌ Indisponible'}
          </span>
        </div>
      </div>
    </div>
  );
}
