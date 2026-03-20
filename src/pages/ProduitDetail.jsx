import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, Package, ExternalLink, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import WhatsAppShare from "@/components/WhatsAppShare";
import ModeDemoClient from "@/components/ModeDemoClient";
import { getVendeurSession } from "@/components/useSessionGuard";

export default function ProduitDetail() {
  const { produitId } = useParams();
  const navigate = useNavigate();
  const [currentImage, setCurrentImage] = useState(0);

  const { data: produit, isLoading } = useQuery({
    queryKey: ["produit_detail", produitId],
    queryFn: async () => {
      const { data } = await supabase
        .from("produits")
        .select("*, categories(nom, emoji)")
        .eq("id", produitId)
        .single();
      return data;
    },
  });

  const formater = (n) => `${Math.round(n || 0).toLocaleString("fr-FR")} FCFA`;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 p-4">
        <Skeleton className="h-64 rounded-2xl mb-4" />
        <Skeleton className="h-8 w-48 mb-2" />
        <Skeleton className="h-20 rounded-xl" />
      </div>
    );
  }

  if (!produit) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-400">
        <div className="text-center">
          <Package className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p>Produit introuvable</p>
          <button onClick={() => navigate(-1)} className="mt-4 text-blue-600 underline text-sm">Retour</button>
        </div>
      </div>
    );
  }

  const images = produit.images || [];
  const variations = produit.variations || [];
  const stockDispo = produit.stock_global || 0;
  const stockOk = stockDispo > 0;
  const categorieName = produit.categories?.nom;
  const categorieEmoji = produit.categories?.emoji;

  return (
    <div className="min-h-screen bg-slate-50 pb-24 md:pb-6">
      {/* Header */}
      <div className="bg-[#1a1f5e] text-white px-4 py-3 sticky top-0 z-10 flex items-center gap-3"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top, 0px))" }}>
        <button onClick={() => navigate(-1)} className="p-1">
          <ChevronLeft className="w-6 h-6 text-white" />
        </button>
        <h1 className="text-base font-bold truncate">{produit.nom}</h1>
      </div>

      {/* Image gallery */}
      {images.length > 0 ? (
        <div className="relative bg-white">
          <img
            src={images[currentImage]}
            alt={produit.nom}
            className="w-full h-64 sm:h-80 object-contain bg-slate-50"
          />
          {images.length > 1 && (
            <div className="flex gap-2 p-3 overflow-x-auto">
              {images.map((img, i) => (
                <img
                  key={i}
                  src={img}
                  alt={`${produit.nom} ${i + 1}`}
                  onClick={() => setCurrentImage(i)}
                  className={`w-16 h-16 object-cover rounded-lg flex-shrink-0 cursor-pointer border-2 ${i === currentImage ? 'border-amber-500' : 'border-transparent'}`}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="h-48 bg-slate-100 flex items-center justify-center">
          <Package className="w-16 h-16 text-slate-300" />
        </div>
      )}

      <div className="p-4 space-y-4">
        {/* Title & badge */}
        <div>
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-xl font-bold text-slate-900">{produit.nom}</h2>
            <Badge className={`text-xs flex-shrink-0 ${stockOk ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"} border-0`}>
              {stockOk ? `${stockDispo} en stock` : "Rupture"}
            </Badge>
          </div>
          {categorieName && (
            <p className="text-sm text-slate-500 mt-1">{categorieEmoji || '🛍️'} {categorieName}</p>
          )}
          {produit.reference && (
            <p className="text-xs text-slate-400 mt-1">Réf: {produit.reference}</p>
          )}
        </div>

        {/* Price */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400">Prix de gros</p>
              <p className="text-2xl font-bold text-slate-900">{formater(produit.prix_gros)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-400">Votre marge</p>
              <p className="text-sm font-semibold text-emerald-600">Libre ≥ prix gros</p>
            </div>
          </div>
        </div>

        {/* Description */}
        {produit.description && (
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <h3 className="font-semibold text-slate-900 text-sm mb-2">Description</h3>
            <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">{produit.description}</p>
          </div>
        )}

        {/* Details */}
        {produit.details && (
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <h3 className="font-semibold text-slate-900 text-sm mb-2">Détails</h3>
            <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">{produit.details}</p>
          </div>
        )}

        {/* Variations */}
        {variations.length > 0 && (
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <h3 className="font-semibold text-slate-900 text-sm mb-3">Variations disponibles</h3>
            {variations.map((v, idx) => (
              <div key={v.nom || idx} className="mb-3 last:mb-0">
                <p className="text-xs text-slate-500 mb-1.5">{v.nom}</p>
                <div className="flex flex-wrap gap-2">
                  {(v.options || []).map(opt => (
                    <span key={opt} className="px-3 py-1.5 bg-slate-100 rounded-lg text-xs text-slate-700 font-medium">
                      {opt}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Telegram link */}
        {produit.lien_telegram && (
          <a
            href={produit.lien_telegram}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-sm font-bold rounded-xl"
          >
            <ExternalLink className="w-4 h-4" />
            📸 Voir images & vidéos Telegram
          </a>
        )}

        {/* Commander button */}
        {stockOk && (
          <button
            onClick={() => navigate('/NouvelleCommandeVendeur', {
              state: {
                produit_id: produit.id,
                produit_nom: produit.nom,
                prix_vente: produit.prix_vente,
              }
            })}
            className="w-full py-4 rounded-xl text-base font-bold text-white"
            style={{
              background: 'linear-gradient(135deg, #f5a623, #e8940f)',
              boxShadow: '0 4px 15px rgba(245,166,35,0.4)',
            }}
          >
            🛒 Commander ce produit
          </button>
        )}
      </div>

    </div>
  );
}
