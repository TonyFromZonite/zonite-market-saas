import React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import PullToRefresh from "@/components/PullToRefresh";
import { useCachedQuery } from "@/components/CacheManager";
import { supabase } from "@/integrations/supabase/client";
import useAdminAccess from "@/hooks/useAdminAccess";

function ResponsiveRow({ children }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {children}
    </div>
  );
}
import {
  DollarSign, TrendingUp, Wallet, AlertTriangle,
  ShoppingCart, Package, ShieldCheck, Lock
} from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import CarteStatistique from "@/components/dashboard/CarteStatistique";
import GraphiqueVentes from "@/components/dashboard/GraphiqueVentes";
import TopProduits from "@/components/dashboard/TopProduits";
import TopVendeurs from "@/components/dashboard/TopVendeurs";
import StockCritique from "@/components/dashboard/StockCritique";
import { getAdminSession } from "@/components/useSessionGuard";
import { getMenuVisible } from "@/components/admin/adminMenuConfig";
import useSousAdminPermissions from "@/components/useSousAdminPermissions";
import { filterTable, listTable } from "@/lib/supabaseHelpers";

const formaterMontant = (n) => `${Math.round(n || 0).toLocaleString("fr-FR")} FCFA`;
const MODULE_EMOJIS = {
  NouvelleVente: "🛒",
  Commandes: "📋",
  GestionCommandes: "🚚",
  CommandesVendeurs: "📋",
  Produits: "📦",
  Vendeurs: "👥",
  GestionKYC: "✅",
  GestionZones: "📍",
  GestionCoursiers: "🚴",
  SupportAdmin: "💬",
};

function DashboardSousAdmin({ sousAdmin, isLoadingPermissions = false }) {
  const activePermissions = Array.isArray(sousAdmin?.permissions) ? sousAdmin.permissions : [];

  const { data: commandesVendeurs = [] } = useCachedQuery(
    'COMMANDES',
    () => listTable("commandes_vendeur", "-created_date", 100),
    { ttl: 5 * 60 * 1000, enabled: true }
  );

  useCachedQuery(
    'PRODUITS',
    () => listTable("produits"),
    { ttl: 30 * 60 * 1000, enabled: activePermissions.includes("Produits") }
  );

  const aujourd = new Date().toISOString().split("T")[0];
  const cmds = Array.isArray(commandesVendeurs) ? commandesVendeurs : [];

  const cmdAujourdhui = cmds.filter(c => (c.created_at || c.created_date)?.split("T")[0] === aujourd).length;
  const cmdAttente = cmds.filter(c => c.statut === "en_attente_validation_admin").length;
  const cmdEnLivraison = cmds.filter(c => c.statut === "en_livraison").length;
  const cmdLivrees = cmds.filter(c => c.statut === "livree").length;

  const allModules = getMenuVisible("sous_admin", activePermissions)
    .filter((module) => module.page !== "TableauDeBord")
    .map((module) => ({
      page: module.page,
      label: module.label,
      emoji: MODULE_EMOJIS[module.page] || "📌",
    }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{
        background: "linear-gradient(to right, #1a1f5e, #2d34a5)",
        borderRadius: 12, padding: 20, color: "white",
        display: "flex", alignItems: "center", gap: 16,
      }}>
        <div style={{
          width: 48, height: 48, background: "#F5C518", borderRadius: 12,
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          <ShieldCheck size={24} color="#1a1f5e" />
        </div>
        <div>
          <p style={{ fontWeight: 700, fontSize: 16, lineHeight: 1.2 }}>{sousAdmin?.nom_complet}</p>
          <p style={{ color: "#FDE68A", fontSize: 13, marginTop: 2 }}>{sousAdmin?.nom_role || "Sous-admin"}</p>
          <p style={{ color: "#CBD5E1", fontSize: 11, marginTop: 2 }}>
            Accès limité à {activePermissions.length} module(s)
          </p>
        </div>
      </div>

      {activePermissions.includes("CommandesVendeurs") && (
        <div>
          <p style={{ fontSize: 11, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 2, marginBottom: 12 }}>Aperçu Commandes</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
            <CarteStatistique titre="Aujourd'hui" valeur={cmdAujourdhui} icone={ShoppingCart} couleur="bleu" />
            <CarteStatistique titre="En attente" valeur={cmdAttente} icone={ShoppingCart} couleur="orange" />
            <CarteStatistique titre="En livraison" valeur={cmdEnLivraison} icone={ShoppingCart} couleur="violet" />
            <CarteStatistique titre="Livrées" valeur={cmdLivrees} icone={ShoppingCart} couleur="vert" />
          </div>
        </div>
      )}

      {allModules.length > 0 && (
        <div>
          <p style={{ fontSize: 11, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 2, marginBottom: 12 }}>Mes Modules</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
            {allModules.map((m) => (
              <Link key={m.page} to={createPageUrl(m.page)} style={{ textDecoration: "none" }}>
                <div style={{
                  background: "white", borderRadius: 12, border: "1px solid #E2E8F0",
                  padding: 16, cursor: "pointer",
                }}>
                  <span style={{ fontSize: 24, display: "block", marginBottom: 8 }}>{m.emoji}</span>
                  <p style={{ fontWeight: 600, color: "#1E293B", fontSize: 13 }}>{m.label}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {allModules.length === 0 && isLoadingPermissions && (
        <div style={{
          background: "white", borderRadius: 12, border: "1px solid #E2E8F0",
          padding: 40, textAlign: "center",
        }}>
          <p style={{ color: "#64748B", fontSize: 13 }}>Chargement des permissions…</p>
        </div>
      )}

      {allModules.length === 0 && !isLoadingPermissions && (
        <div style={{
          background: "white", borderRadius: 12, border: "1px solid #E2E8F0",
          padding: 40, textAlign: "center",
        }}>
          <Lock size={40} color="#CBD5E1" style={{ margin: "0 auto 12px" }} />
          <p style={{ color: "#64748B", fontSize: 13 }}>Aucun module accessible. Contactez l'administrateur principal.</p>
        </div>
      )}
    </div>
  );
}

function DashboardAdmin() {
  const REFRESH = 60 * 1000;
  const queryClient = useQueryClient();
  const { isReady } = useAdminAccess();

  const { data: ventes = [], isLoading: chargementVentes } = useQuery({
    queryKey: ["dashboard_ventes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ventes")
        .select("id, vendeur_id, vendeur_email, produit_id, commande_id, quantite, montant_total, commission_vendeur, profit_zonite, prix_achat_unitaire, marge_zonite, prix_achat, prix_gros, prix_final_client, created_at")
        .order("created_at", { ascending: false }).limit(500);
      if (error) { console.error(error); return []; }
      return data || [];
    },
    enabled: isReady,
    staleTime: 10 * 1000,
    refetchInterval: REFRESH,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  const { data: produits = [], isLoading: chargementProduits } = useQuery({
    queryKey: ["dashboard_produits"],
    queryFn: async () => {
      const { data, error } = await supabase.from("produits")
        .select("id, nom, reference, prix_vente, prix_achat, stock_global, seuil_alerte_stock, actif, categorie_id, created_at")
        .eq("actif", true);
      if (error) { console.error(error); return []; }
      return data || [];
    },
    enabled: isReady,
    staleTime: 30 * 1000,
    refetchInterval: REFRESH,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  const produitsActifs = (Array.isArray(produits) ? produits : []).filter(p => p.statut !== 'supprime');

  const { data: vendeurs = [], isLoading: chargementVendeurs } = useQuery({
    queryKey: ["dashboard_vendeurs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sellers")
        .select("id, full_name, email, solde_commission, total_commissions_gagnees, total_commissions_payees, seller_status, created_at");
      if (error) { console.error(error); return []; }
      return data || [];
    },
    enabled: isReady,
    staleTime: 10 * 1000,
    refetchInterval: REFRESH,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  const vendeursActifs = (Array.isArray(vendeurs) ? vendeurs : []).filter(v => v.seller_status === 'active_seller');

  const { data: commandesVendeurs = [] } = useQuery({
    queryKey: ["dashboard_commandes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("commandes_vendeur")
        .select("id, statut, created_at")
        .order("created_at", { ascending: false }).limit(200);
      if (error) { console.error(error); return []; }
      return data || [];
    },
    staleTime: 10 * 1000,
    refetchInterval: REFRESH,
    refetchOnWindowFocus: true,
  });

  const { data: candidaturesEnAttente } = useQuery({
    queryKey: ["dashboard_candidatures"],
    queryFn: () => filterTable("candidatures_vendeur", { statut: "en_attente" }),
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000,
    refetchOnWindowFocus: true,
  });

  const { data: kycEnAttente } = useQuery({
    queryKey: ["dashboard_kyc"],
    queryFn: () => filterTable("sellers", { statut_kyc: "en_attente" }),
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000,
    refetchOnWindowFocus: true,
  });

  const { data: paiementsEnAttente } = useQuery({
    queryKey: ["dashboard_paiements"],
    queryFn: () => filterTable("demandes_paiement_vendeur", { statut: "en_attente" }),
    staleTime: 10 * 1000,
    refetchInterval: REFRESH,
    refetchOnWindowFocus: true,
  });

  const enChargement = chargementVentes || chargementProduits || chargementVendeurs;

  const ventesArray = Array.isArray(ventes) ? ventes : [];
  const produitsArray = Array.isArray(produitsActifs) ? produitsActifs : [];
  const vendeursArray = Array.isArray(vendeursActifs) ? vendeursActifs : [];
  const commandesArray = Array.isArray(commandesVendeurs) ? commandesVendeurs : [];
  const candidaturesArray = Array.isArray(candidaturesEnAttente) && candidaturesEnAttente !== null ? candidaturesEnAttente : [];
  const kycArray = Array.isArray(kycEnAttente) && kycEnAttente !== null ? kycEnAttente : [];
  const paiementsArray = Array.isArray(paiementsEnAttente) && paiementsEnAttente !== null ? paiementsEnAttente : [];

  const chiffreAffaires = ventesArray.reduce((s, v) => s + (v.montant_total || 0), 0);
  const totalCommissionsVendeurs = ventesArray.reduce((s, v) => s + (v.commission_vendeur || 0), 0);
  const margeZonite = ventesArray.reduce((s, v) => s + (v.marge_zonite || v.profit_zonite || 0), 0);

  const commissionsAPayer = vendeursArray.reduce((s, v) => s + (v.solde_commission || 0), 0);
  const stockCritique = produitsArray.filter(p => (p.stock_global || 0) <= (p.seuil_alerte_stock || 5)).length;

  const aujourdhui = new Date().toISOString().split("T")[0];
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  const ventesAujourdhui = ventesArray.filter(v => {
    const d = v.created_at ? v.created_at.split("T")[0] : v.created_date?.split("T")[0];
    return d === aujourdhui;
  });
  const caAujourdhui = ventesAujourdhui.reduce((s, v) => s + (v.montant_total || 0), 0);
  const commAujourdhui = ventesAujourdhui.reduce((s, v) => s + (v.commission_vendeur || 0), 0);
  const margeAujourdhui = ventesAujourdhui.reduce((s, v) => s + (v.marge_zonite || v.profit_zonite || 0), 0);

  const ventesMonth = ventesArray.filter(v => {
    const d = new Date(v.created_at || v.created_date);
    return d >= startOfMonth;
  });
  const caMois = ventesMonth.reduce((s, v) => s + (v.montant_total || 0), 0);
  const commMois = ventesMonth.reduce((s, v) => s + (v.commission_vendeur || 0), 0);
  const margeMois = ventesMonth.reduce((s, v) => s + (v.marge_zonite || v.profit_zonite || 0), 0);

  const commandesVendeursAujourdhui = commandesArray.filter(c => (c.created_at || c.created_date)?.split("T")[0] === aujourdhui).length;
  const commissionsVendeursAPayer = paiementsArray.reduce((s, p) => s + (p.montant || 0), 0);

  if (enChargement) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
          {Array(8).fill(0).map((_, i) => (
            <div key={i} style={{ height: 96, borderRadius: 12, background: "#E2E8F0", animation: "pulse 1.5s infinite" }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <PullToRefresh onRefresh={() => queryClient.invalidateQueries()}>
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {(candidaturesArray.length > 0 || kycArray.length > 0 || paiementsArray.length > 0) && (
        <div style={{ background: "#FEFCE8", border: "1px solid #FDE68A", borderRadius: 12, padding: 16 }}>
          <p style={{ fontWeight: 600, color: "#92400E", fontSize: 13, marginBottom: 8 }}>⚠️ Actions requises</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {candidaturesArray.length > 0 && (
              <Link to={createPageUrl("Vendeurs")} style={{ fontSize: 12, background: "#FEF3C7", color: "#92400E", padding: "4px 10px", borderRadius: 20, fontWeight: 500, textDecoration: "none" }}>
                {candidaturesArray.length} candidature{candidaturesArray.length > 1 ? "s" : ""} en attente
              </Link>
            )}
            {kycArray.length > 0 && (
              <Link to={createPageUrl("Vendeurs")} style={{ fontSize: 12, background: "#FFEDD5", color: "#9A3412", padding: "4px 10px", borderRadius: 20, fontWeight: 500, textDecoration: "none" }}>
                {kycArray.length} KYC à valider
              </Link>
            )}
            {paiementsArray.length > 0 && (
              <Link to={createPageUrl("Vendeurs")} style={{ fontSize: 12, background: "#FEE2E2", color: "#991B1B", padding: "4px 10px", borderRadius: 20, fontWeight: 500, textDecoration: "none" }}>
                {paiementsArray.length} paiement{paiementsArray.length > 1 ? "s" : ""} en attente ({formaterMontant(commissionsVendeursAPayer)})
              </Link>
            )}
          </div>
        </div>
      )}

      <div>
        <p style={{ fontSize: 11, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 2, marginBottom: 12 }}>📊 Chiffre d'Affaires</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
          <CarteStatistique titre="CA Aujourd'hui" valeur={formaterMontant(caAujourdhui)} icone={DollarSign} couleur="bleu" />
          <CarteStatistique titre="CA Ce Mois" valeur={formaterMontant(caMois)} icone={DollarSign} couleur="bleu" />
        </div>
      </div>

      <div>
        <p style={{ fontSize: 11, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 2, marginBottom: 12 }}>💸 Commissions Vendeurs</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
          <CarteStatistique titre="Comm. Aujourd'hui" valeur={formaterMontant(commAujourdhui)} icone={Wallet} couleur="orange" />
          <CarteStatistique titre="Comm. Ce Mois" valeur={formaterMontant(commMois)} icone={Wallet} couleur="orange" />
        </div>
      </div>

      <div>
        <p style={{ fontSize: 11, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 2, marginBottom: 12 }}>🏦 Marge ZONITE Market</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
          <CarteStatistique titre="Marge Aujourd'hui" valeur={formaterMontant(margeAujourdhui)} icone={TrendingUp} couleur="vert" />
          <CarteStatistique titre="Marge Ce Mois" valeur={formaterMontant(margeMois)} icone={TrendingUp} couleur="vert" />
        </div>
      </div>

      <div>
        <p style={{ fontSize: 11, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 2, marginBottom: 12 }}>Opérationnel</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
          <CarteStatistique titre="Cmds Vendeurs Aujourd'hui" valeur={commandesVendeursAujourdhui} icone={ShoppingCart} couleur="indigo" />
          <CarteStatistique titre="Commissions à Payer" valeur={formaterMontant(commissionsAPayer)} icone={Wallet} couleur="orange" />
          <CarteStatistique titre="Stock Critique" valeur={stockCritique} icone={AlertTriangle} couleur={stockCritique > 0 ? "rouge" : "vert"} />
          <CarteStatistique titre="Total Commandes" valeur={commandesArray.length} icone={Package} couleur="jaune" />
        </div>
      </div>

      <ResponsiveRow>
        <GraphiqueVentes ventes={ventesArray} />
        <StockCritique produits={produitsArray} />
      </ResponsiveRow>

      <ResponsiveRow>
        <TopProduits produits={produitsArray} ventes={ventesArray} />
        <TopVendeurs vendeurs={vendeursArray} />
      </ResponsiveRow>
    </div>
    </PullToRefresh>
  );
}

export default function TableauDeBord() {
  const { sousAdmin, isLoadingPermissions } = useSousAdminPermissions();
  const adminSession = getAdminSession();

  if (sousAdmin) {
    return <DashboardSousAdmin sousAdmin={sousAdmin} isLoadingPermissions={isLoadingPermissions} />;
  }

  if (adminSession) {
    return <DashboardAdmin />;
  }

  return <DashboardAdmin />;
}
