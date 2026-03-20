import React, { useState, useEffect, useCallback } from "react";
import PullToRefresh from "@/components/PullToRefresh";
import { getVendeurSessionAsync } from "@/components/useSessionGuard";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Search, ChevronLeft, ShoppingBag } from "lucide-react";
import BanniereKycPending from "@/components/BanniereKycPending";

import { supabase } from "@/integrations/supabase/client";

const STATUTS = {
  en_attente_validation_admin: { label: "⏳ En attente validation", couleur: "bg-yellow-100 text-yellow-800" },
  validee_admin:               { label: "✓ Validée", couleur: "bg-blue-100 text-blue-800" },
  attribuee_livreur:           { label: "🚴 Livreur attribué", couleur: "bg-indigo-100 text-indigo-800" },
  en_livraison:                { label: "🚚 En livraison", couleur: "bg-purple-100 text-purple-800" },
  livree:                      { label: "✅ Livrée", couleur: "bg-emerald-100 text-emerald-800" },
  echec_livraison:             { label: "❌ Échec livraison", couleur: "bg-orange-100 text-orange-800" },
  annulee:                     { label: "🚫 Annulée", couleur: "bg-red-100 text-red-800" },
  en_attente:                  { label: "⏳ En attente", couleur: "bg-yellow-100 text-yellow-800" },
  en_preparation:              { label: "En préparation", couleur: "bg-blue-100 text-blue-800" },
  echec:                       { label: "Échec", couleur: "bg-red-100 text-red-800" },
};

export default function MesCommandesVendeur() {
  const [compteVendeur, setCompteVendeur] = useState(null);
  const [recherche, setRecherche] = useState("");
  const [sessionLoading, setSessionLoading] = useState(true);

  useEffect(() => {
    const charger = async () => {
      const session = await getVendeurSessionAsync();
      if (!session) {
        window.location.href = createPageUrl("Connexion");
        return;
      }
      // Get fresh seller data
      const { data: seller } = await supabase
        .from("sellers")
        .select("*")
        .eq("id", session.id)
        .maybeSingle();
      
      setCompteVendeur(seller || session);
      setSessionLoading(false);
    };
    charger();
  }, []);

  const { data: commandes = [], isLoading } = useQuery({
    queryKey: ["commandes_vendeur", compteVendeur?.id, compteVendeur?.email],
    queryFn: async () => {
      // Query by both vendeur_id and email to catch any mismatches
      const { data } = await supabase.from("commandes_vendeur").select("*")
        .or(`vendeur_id.eq.${compteVendeur.id},vendeur_email.eq.${compteVendeur.email}`)
        .order("created_at", { ascending: false })
        .limit(100);
      return data || [];
    },
    enabled: !!compteVendeur?.id,
  });

  const formater = n => `${Math.round(n || 0).toLocaleString("fr-FR")} FCFA`;
  const formaterDate = d => d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "—";

  const commandesFiltrees = commandes.filter(c =>
    `${c.produit_nom} ${c.client_nom} ${c.client_ville}`.toLowerCase().includes(recherche.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50 pb-24 md:pb-6">
      {compteVendeur?.seller_status === "kyc_pending" && <BanniereKycPending />}
      <div className="bg-[#1a1f5e] text-white px-4 pb-4 sticky top-0 z-10" style={{ paddingTop: "max(1.25rem, env(safe-area-inset-top, 0px))" }}>
        <div className="flex items-center gap-3 mb-3">
          <Link to={createPageUrl("EspaceVendeur")}>
            <ChevronLeft className="w-6 h-6 text-white" />
          </Link>
          <h1 className="text-lg font-bold">Mes commandes</h1>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Rechercher..."
            value={recherche}
            onChange={e => setRecherche(e.target.value)}
            className="pl-9 bg-white border-0"
          />
        </div>
      </div>

      <div className="p-3 sm:p-4 space-y-2 sm:space-y-3 max-w-screen-md mx-auto w-full">
        {isLoading ? (
          Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)
        ) : commandesFiltrees.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <ShoppingBag className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p>Aucune commande trouvée</p>
          </div>
        ) : (
          commandesFiltrees.map(c => {
            const prixFinal = Number(c.prix_final_client) || 0;
            const prixGros = Number(c.prix_unitaire) || 0;
            const commEst = Math.max(0, (prixFinal - prixGros) * (c.quantite || 1));
            return (
              <div key={c.id} className="bg-white rounded-2xl p-4 shadow-sm">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1 min-w-0 mr-3">
                    <p className="font-semibold text-slate-900 truncate">{c.produit_nom}</p>
                    <p className="text-xs text-slate-500">{c.quantite} unité{c.quantite > 1 ? "s" : ""} • {formaterDate(c.created_at)}</p>
                  </div>
                  <Badge className={`${STATUTS[c.statut]?.couleur} text-xs border-0 flex-shrink-0`}>
                    {STATUTS[c.statut]?.label}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-400">Client</p>
                    <p className="text-sm font-medium text-slate-700">{c.client_nom} • {c.client_ville}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-400">Commission estimée</p>
                    <p className="font-bold text-emerald-600">{formater(commEst)}</p>
                  </div>
                </div>
                {c.notes_admin && (
                  <div className="mt-2 p-2 bg-blue-50 rounded-lg text-xs text-blue-700">
                    📋 Admin : {c.notes_admin}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      
    </div>
  );
}