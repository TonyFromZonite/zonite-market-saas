import React, { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, Package, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import ShareProductModal from "@/components/vendor/ShareProductModal";
import ModeDemoClient from "@/components/ModeDemoClient";
import { getVendeurSession } from "@/components/useSessionGuard";
import {
  normalizeVariations,
  getImageVariation,
  isOptionAvailable,
  isOptionAvailableInCoursiers,
  getCoursierIdsForVille,
  getOptionStock,
  getEffectivePrices,
  getDisplayImage,
} from "@/lib/variationHelpers";

export default function ProduitDetail() {
  const { produitId } = useParams();
  const navigate = useNavigate();
  const [selected, setSelected] = useState({}); // { [varName]: optValue }
  const [galleryIdx, setGalleryIdx] = useState(0);
  const [showDemo, setShowDemo] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const session = getVendeurSession();

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

  // Données logistiques pour filtrer la dispo des variations sur la ville du vendeur
  const { data: seller } = useQuery({
    queryKey: ["seller_for_detail", session?.id, session?.email],
    enabled: !!(session?.id || session?.email),
    queryFn: async () => {
      let q = supabase.from("sellers").select("id, ville, quartier");
      if (session?.id) q = q.eq("id", session.id);
      else q = q.eq("email", session.email);
      const { data } = await q.maybeSingle();
      return data;
    },
  });
  const { data: coursiersList = [] } = useQuery({
    queryKey: ["coursiers_for_detail"],
    queryFn: async () => (await supabase.from("coursiers").select("*").eq("actif", true)).data || [],
  });
  const { data: zonesLivList = [] } = useQuery({
    queryKey: ["zones_livraison_for_detail"],
    queryFn: async () => (await supabase.from("zones_livraison").select("*").eq("actif", true)).data || [],
  });
  const { data: quartiersList = [] } = useQuery({
    queryKey: ["quartiers_for_detail"],
    queryFn: async () => (await supabase.from("quartiers").select("*").eq("actif", true)).data || [],
  });
  const { data: villesList = [] } = useQuery({
    queryKey: ["villes_for_detail"],
    queryFn: async () => (await supabase.from("villes_cameroun").select("*").eq("actif", true)).data || [],
  });

  const vendeurVille = useMemo(() => {
    if (!seller?.ville) return null;
    return villesList.find((v) => v.nom.toLowerCase() === seller.ville.toLowerCase().trim()) || null;
  }, [seller, villesList]);
  const vendeurQuartier = useMemo(() => {
    if (!vendeurVille || !seller?.quartier) return null;
    return quartiersList.find(
      (q) => q.ville_id === vendeurVille.id && q.nom.toLowerCase() === seller.quartier.toLowerCase().trim()
    ) || null;
  }, [seller, quartiersList, vendeurVille]);
  const coursierIdsForVendeur = useMemo(() => {
    if (!vendeurVille) return null;
    return getCoursierIdsForVille(coursiersList, zonesLivList, quartiersList, vendeurVille.id, vendeurQuartier?.id);
  }, [vendeurVille, vendeurQuartier, coursiersList, zonesLivList, quartiersList]);
  const checkAvailable = (varName, value) =>
    coursierIdsForVendeur
      ? isOptionAvailableInCoursiers(produit, varName, value, coursierIdsForVendeur)
      : isOptionAvailable(produit, varName, value);
  const ruptureLabel = coursierIdsForVendeur ? `Indispo. à ${vendeurVille?.nom || ""}`.trim() : "Rupture";

  const formater = (n) => `${Math.round(n || 0).toLocaleString("fr-FR")} FCFA`;

  const variations = useMemo(() => normalizeVariations(produit?.variations), [produit]);
  const imageVar = useMemo(() => getImageVariation(produit?.variations), [produit]);
  const prices = useMemo(() => getEffectivePrices(produit, selected), [produit, selected]);

  // Image affichée : option image sélectionnée > galerie produit
  const mainImage = useMemo(() => {
    const fromOption = getDisplayImage(produit, selected);
    if (imageVar && selected[imageVar.nom]) return fromOption;
    return (produit?.images || [])[galleryIdx] || fromOption;
  }, [produit, selected, imageVar, galleryIdx]);

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

      {/* Image principale */}
      {mainImage ? (
        <div className="relative bg-white">
          <img
            src={mainImage}
            alt={produit.nom}
            className="w-full h-64 sm:h-80 object-contain bg-slate-50"
          />
          {images.length > 1 && !(imageVar && selected[imageVar.nom]) && (
            <div className="flex gap-2 p-3 overflow-x-auto">
              {images.map((img, i) => (
                <img
                  key={i}
                  src={img}
                  alt={`${produit.nom} ${i + 1}`}
                  onClick={() => setGalleryIdx(i)}
                  className={`w-16 h-16 object-cover rounded-lg flex-shrink-0 cursor-pointer border-2 ${i === galleryIdx ? 'border-amber-500' : 'border-transparent'}`}
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

        {/* Price (dynamic with variation) */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400">Prix de gros</p>
              <p className="text-2xl font-bold text-slate-900">{formater(prices.prix_gros)}</p>
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

        {/* Sélecteur de variations : image-variation en haut (cliquable), autres en chips */}
        {variations.length > 0 && (
          <div className="bg-white rounded-2xl p-4 shadow-sm space-y-4">
            <h3 className="font-semibold text-slate-900 text-sm">Choisir une variation</h3>
            {variations.map((v) => {
              if (v.is_image_variation) {
                return (
                  <div key={v.id}>
                    <p className="text-xs text-slate-500 mb-2">{v.nom}</p>
                    <div className="grid grid-cols-4 gap-2">
                      {v.options.map((opt) => {
                        const available = checkAvailable(v.nom, opt.value);
                        const isSelected = selected[v.nom] === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            disabled={!available}
                            onClick={() => setSelected((p) => ({ ...p, [v.nom]: opt.value }))}
                            className={`relative rounded-xl border-2 overflow-hidden transition-all ${
                              isSelected ? "border-amber-500" : "border-transparent"
                            } ${!available ? "opacity-40 cursor-not-allowed grayscale" : "cursor-pointer hover:border-amber-300"}`}
                          >
                            {opt.image_url ? (
                              <img src={opt.image_url} alt={opt.value} className="w-full aspect-square object-cover" />
                            ) : (
                              <div className="w-full aspect-square bg-slate-100 flex items-center justify-center text-slate-400 text-xs">
                                {opt.value}
                              </div>
                            )}
                            <p className="text-[10px] text-center py-1 bg-white text-slate-700 font-medium truncate">{opt.value}</p>
                            {!available && (
                              <span className="absolute top-1 right-1 text-[9px] bg-red-500 text-white rounded px-1">{ruptureLabel}</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              }
              // chips classiques (filtrées par dispo si une variation image est déjà choisie)
              return (
                <div key={v.id}>
                  <p className="text-xs text-slate-500 mb-2">{v.nom}</p>
                  <div className="flex flex-wrap gap-2">
                    {v.options.map((opt) => {
                      const available = checkAvailable(v.nom, opt.value);
                      const isSelected = selected[v.nom] === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          disabled={!available}
                          onClick={() => setSelected((p) => ({ ...p, [v.nom]: opt.value }))}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                            isSelected ? "bg-amber-500 text-white border-amber-500" : "bg-slate-100 text-slate-700 border-slate-200"
                          } ${!available ? "opacity-40 cursor-not-allowed line-through" : "cursor-pointer hover:border-amber-300"}`}
                        >
                          {opt.value}{!available && ` • ${ruptureLabel}`}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
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

        {/* BUTTON 1 — Commander (GREEN) */}
        {stockOk && (
          <button
            onClick={() => navigate('/NouvelleCommandeVendeur', {
              state: {
                produit_id: produit.id,
                produit_nom: produit.nom,
                prix_vente: prices.prix_vente,
                prix_gros: prices.prix_gros,
                selected_variations: selected,
              }
            })}
            className="w-full py-4 rounded-xl text-base font-bold text-white border-none cursor-pointer flex items-center justify-center gap-2.5 active:scale-[0.97] transition-transform"
            style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)', boxShadow: '0 4px 15px rgba(34,197,94,0.35)' }}
          >
            🛒 Commander ce produit
          </button>
        )}

        {/* BUTTON 2 — Partager (WhatsApp green) */}
        <button
          onClick={() => setShowShare(true)}
          className="w-full py-3.5 rounded-xl text-white text-sm font-bold flex items-center justify-center gap-2.5 active:scale-[0.97] transition-transform border-none cursor-pointer"
          style={{ background: '#25D366' }}
        >
          <span style={{ fontSize: '18px' }}>💬</span>
          Partager ce produit
        </button>
        {showShare && (
          <ShareProductModal produit={produit} seller={session} selectedVariations={selected} onClose={() => setShowShare(false)} />
        )}

        {/* BUTTON 3 — Demo (Blue) */}
        <button
          onClick={() => setShowDemo(true)}
          className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 active:scale-[0.97] transition-transform cursor-pointer"
          style={{ background: 'rgba(59,130,246,0.15)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.3)', borderRadius: '12px' }}
        >
          👁️ Mode démonstration client
        </button>
      </div>

      {showDemo && <ModeDemoClient produit={produit} onClose={() => setShowDemo(false)} />}
    </div>
  );
}
