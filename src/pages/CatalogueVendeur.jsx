import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Link, useNavigate, useParams } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Search, Package, ChevronLeft, PlayCircle, Lock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { getVendeurSession } from "@/components/useSessionGuard";
import BlocageKycPending from "@/components/BlocageKycPending";

import { filterTable } from "@/lib/supabaseHelpers";
import { supabase } from "@/integrations/supabase/client";

export default function CatalogueVendeur() {
  const navigate = useNavigate();
  const { categorieId } = useParams();
  const [compteVendeur, setCompteVendeur] = useState(null);
  const [isLocked, setIsLocked] = useState(null); // null = loading
  const [recherche, setRecherche] = useState("");

  useEffect(() => {
    const checkAccess = async () => {
      const { getVendeurSessionAsync } = await import("@/components/useSessionGuard");
      const session = await getVendeurSessionAsync();
      if (!session) { window.location.href = createPageUrl("Connexion"); return; }

      // Always load fresh seller from DB
      let seller = null;
      if (session.id) {
        const { data } = await supabase.from("sellers").select("*").eq("id", session.id).maybeSingle();
        seller = data;
      }
      if (!seller && session.email) {
        const { data } = await supabase.from("sellers").select("*").eq("email", session.email).maybeSingle();
        seller = data;
      }
      if (!seller) { setIsLocked(true); return; }

      setCompteVendeur(seller);

      if (seller.seller_status === "kyc_pending") {
        setIsLocked(false);
        return;
      }

      if (!seller.catalogue_debloque || !seller.training_completed) {
        setIsLocked(true);
        return;
      }

      setIsLocked(false);
    };
    checkAccess();
  }, []);

  // Blocage KYC
  if (compteVendeur && compteVendeur.seller_status === "kyc_pending") {
    return <BlocageKycPending titre="Catalogue Produits" />;
  }

  // Loading
  if (isLocked === null) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Locked screen
  if (isLocked) {
    return (
      <div className="min-h-screen bg-[#1a1f5e] flex flex-col items-center justify-center px-6 text-center text-white">
        <div className="text-6xl mb-4">🔒</div>
        <h2 className="text-xl font-bold mb-3">Catalogue non débloqué</h2>
        <p className="text-white/60 mb-8 max-w-xs leading-relaxed">
          Visionnez la vidéo de formation Zonite Market pour accéder à tous nos produits.
        </p>

        {/* Blurred preview */}
        <div className="w-full max-w-sm h-48 bg-white/5 rounded-xl mb-8 overflow-hidden"
          style={{ filter: 'blur(8px)' }}>
          <div className="flex flex-wrap gap-2 p-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="w-20 h-20 bg-white/10 rounded-lg" />
            ))}
          </div>
        </div>

        <button
          onClick={() => navigate(createPageUrl("VideoFormation"))}
          className="px-8 py-4 rounded-xl text-base font-bold text-white"
          style={{
            background: 'linear-gradient(135deg, #f5a623, #e8940f)',
            boxShadow: '0 4px 15px rgba(245,166,35,0.4)',
          }}
        >
          ▶ Voir la formation
        </button>

        <button
          onClick={() => navigate(createPageUrl("EspaceVendeur"))}
          className="mt-4 text-white/50 text-sm underline"
        >
          Retour à l'accueil
        </button>
      </div>
    );
  }

  // Unlocked: show categories or products
  if (categorieId) {
    return <ProduitsParCategorie categorieId={categorieId} compteVendeur={compteVendeur} />;
  }

  return <CategoriesGrid compteVendeur={compteVendeur} recherche={recherche} setRecherche={setRecherche} />;
}

// ─── Categories Grid ───────────────────────────────────────
function CategoriesGrid({ compteVendeur, recherche, setRecherche }) {
  const navigate = useNavigate();

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["categories_with_count"],
    queryFn: async () => {
      const { data: cats } = await supabase
        .from("categories")
        .select("*")
        .eq("actif", true)
        .order("ordre");

      const withCount = await Promise.all(
        (cats || []).map(async (cat) => {
          const { count } = await supabase
            .from("produits")
            .select("*", { count: "exact", head: true })
            .eq("categorie_id", cat.id)
            .eq("actif", true);
          return { ...cat, produits_count: count || 0 };
        })
      );

      return withCount.filter(c => c.produits_count > 0);
    },
  });

  const filtered = categories.filter(c =>
    c.nom.toLowerCase().includes((recherche || "").toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50 pb-24 md:pb-6">
      {/* Header */}
      <div className="bg-[#1a1f5e] text-white px-4 pb-4 sticky top-0 z-10" style={{ paddingTop: "max(1.25rem, env(safe-area-inset-top, 0px))" }}>
        <div className="flex items-center gap-3 mb-3">
          <Link to={createPageUrl("EspaceVendeur")}>
            <ChevronLeft className="w-6 h-6 text-white" />
          </Link>
          <div>
            <h1 className="text-lg font-bold">Catalogue Zonite Market</h1>
            <p className="text-xs text-white/60">Sélectionnez une catégorie</p>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Rechercher une catégorie..."
            value={recherche}
            onChange={e => setRecherche(e.target.value)}
            className="pl-9 bg-white border-0"
          />
        </div>
      </div>

      <div className="p-3 sm:p-4 max-w-screen-md mx-auto w-full">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <Package className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p>Aucune catégorie disponible</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filtered.map(cat => (
              <div
                key={cat.id}
                onClick={() => navigate(`/CatalogueVendeur/${cat.id}`)}
                className="bg-white rounded-2xl p-5 text-center cursor-pointer border border-slate-100 shadow-sm hover:shadow-md transition-shadow active:scale-[0.98]"
              >
                <div className="text-4xl mb-3">{cat.emoji || '🛍️'}</div>
                <h3 className="text-sm font-bold text-slate-900 mb-1 leading-tight">{cat.nom}</h3>
                {cat.description && (
                  <p className="text-xs text-slate-400 mb-2 line-clamp-2">{cat.description}</p>
                )}
                <span className="inline-block bg-amber-50 text-amber-700 px-3 py-1 rounded-full text-xs font-semibold">
                  {cat.produits_count} produit{cat.produits_count > 1 ? 's' : ''}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}

// ─── Products by Category ──────────────────────────────────
function ProduitsParCategorie({ categorieId, compteVendeur }) {
  const navigate = useNavigate();
  const [recherche, setRecherche] = useState("");

  const { data: categorie } = useQuery({
    queryKey: ["categorie", categorieId],
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("*").eq("id", categorieId).single();
      return data;
    },
  });

  const { data: produits = [], isLoading } = useQuery({
    queryKey: ["produits_categorie", categorieId],
    queryFn: async () => {
      const { data } = await supabase
        .from("produits")
        .select("*")
        .eq("categorie_id", categorieId)
        .eq("actif", true)
        .order("nom");
      return data || [];
    },
  });

  const formater = (n) => `${Math.round(n || 0).toLocaleString("fr-FR")} FCFA`;

  const filtered = produits.filter(p =>
    `${p.nom} ${p.description || ""} ${p.reference || ""}`.toLowerCase().includes(recherche.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50 pb-24 md:pb-6">
      {/* Header */}
      <div className="bg-[#1a1f5e] text-white px-4 pb-4 sticky top-0 z-10" style={{ paddingTop: "max(1.25rem, env(safe-area-inset-top, 0px))" }}>
        <div className="flex items-center gap-3 mb-3">
          <button onClick={() => navigate(createPageUrl("CatalogueVendeur"))} className="p-1">
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>
          <div>
            <h1 className="text-lg font-bold">{categorie?.emoji || '🛍️'} {categorie?.nom || 'Produits'}</h1>
            <p className="text-xs text-white/60">{filtered.length} produit{filtered.length > 1 ? 's' : ''}</p>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Rechercher un produit..."
            value={recherche}
            onChange={e => setRecherche(e.target.value)}
            className="pl-9 bg-white border-0"
          />
        </div>
      </div>

      <div className="p-3 sm:p-4 max-w-screen-md mx-auto w-full">
        {isLoading ? (
          <div className="grid grid-cols-1 gap-4">
            {Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <Package className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p>Aucun produit dans cette catégorie</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filtered.map(p => {
              const stockDispo = p.stock_global || 0;
              const stockOk = stockDispo > 0;
              const imageUrl = (p.images && p.images.length > 0) ? p.images[0] : null;

              return (
                <div
                  key={p.id}
                  onClick={() => navigate(`/ProduitDetail/${p.id}`)}
                  className="bg-white rounded-2xl shadow-sm overflow-hidden cursor-pointer active:scale-[0.99] transition-transform"
                >
                  <div className="flex">
                    {imageUrl ? (
                      <img src={imageUrl} alt={p.nom} className="w-28 h-28 object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-28 h-28 bg-slate-100 flex items-center justify-center flex-shrink-0">
                        <Package className="w-8 h-8 text-slate-300" />
                      </div>
                    )}
                    <div className="p-3 flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold text-slate-900 text-sm leading-tight">{p.nom}</h3>
                        <Badge className={`text-xs flex-shrink-0 ${stockOk ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"} border-0`}>
                          {stockOk ? "Dispo" : "Rupture"}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">{p.description}</p>
                      <div className="mt-2">
                        <p className="text-xs text-slate-400">Prix de gros</p>
                        <p className="font-bold text-slate-900 text-sm">{formater(p.prix_gros)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
