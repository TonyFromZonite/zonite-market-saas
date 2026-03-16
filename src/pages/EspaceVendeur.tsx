import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ShoppingBag, Package, Clock, CheckCircle2, Plus, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getVendeurSession, clearAllSessions } from "@/components/useSessionGuard";
import { LOGO_URL as LOGO } from "@/components/constants";
import BanniereKycPending from "@/components/BanniereKycPending";
import { SELLER_STATUSES, canAccessFeature } from "@/components/SellerStatusEngine";

const STATUTS: Record<string, { label: string; couleur: string }> = {
  en_attente_validation_admin: { label: "En attente", couleur: "bg-yellow-100 text-yellow-800" },
  validee_admin: { label: "Validée", couleur: "bg-blue-100 text-blue-800" },
  en_livraison: { label: "En livraison 🚚", couleur: "bg-purple-100 text-purple-800" },
  livree: { label: "Livrée ✓", couleur: "bg-emerald-100 text-emerald-800" },
  annulee: { label: "Annulée", couleur: "bg-red-100 text-red-800" },
};

export default function EspaceVendeur() {
  const [compteVendeur, setCompteVendeur] = useState<any>(null);
  const [commandes, setCommandes] = useState<any[]>([]);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    const charger = async () => {
      const session = getVendeurSession();
      if (!session) { window.location.href = createPageUrl("Connexion"); return; }

      if (session.id) {
        setCompteVendeur(session);
        // Load orders
        const { data } = await supabase.from('commandes_vendeur').select('*').eq('vendeur_id', session.id).order('created_at', { ascending: false }).limit(50);
        setCommandes(data || []);
      } else if (session.email) {
        const { data: seller } = await supabase.from('sellers').select('*').eq('email', session.email as string).single();
        if (seller) {
          setCompteVendeur(seller);
          sessionStorage.setItem("vendeur_session", JSON.stringify({ ...seller, role: 'vendeur' }));
          const { data } = await supabase.from('commandes_vendeur').select('*').eq('vendeur_id', seller.id).order('created_at', { ascending: false }).limit(50);
          setCommandes(data || []);
        } else {
          window.location.href = createPageUrl("Connexion");
          return;
        }
      }
      setChargement(false);
    };
    charger();
  }, []);

  const formater = (n: number) => `${Math.round(n || 0).toLocaleString("fr-FR")} FCFA`;

  const deconnexion = () => { clearAllSessions(); supabase.auth.signOut(); window.location.href = createPageUrl("Connexion"); };

  if (chargement) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 space-y-4">
        {Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
      </div>
    );
  }

  if (!compteVendeur) return null;

  const status = compteVendeur.seller_status;
  const isKycPending = status === SELLER_STATUSES.KYC_PENDING;
  const isKycRequired = status === SELLER_STATUSES.KYC_REQUIRED;
  const canDoSales = canAccessFeature(status, 'sales', compteVendeur.training_completed);

  const menuItems = [
    { label: "Mes Commandes", icon: ShoppingBag, page: "MesCommandesVendeur", disabled: !canDoSales },
    { label: "Catalogue", icon: Package, page: "CatalogueVendeur", disabled: !compteVendeur.catalogue_debloque },
    { label: "Formation", icon: CheckCircle2, page: "VideoFormation", disabled: false },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-50 px-4 py-3 flex items-center justify-between" style={{ background: "linear-gradient(135deg, #0d1240 0%, #1a1f5e 100%)" }}>
        <div className="flex items-center gap-3">
          <img src={LOGO} alt="Zonite" className="h-9 w-9 rounded-full object-cover border border-[#F5C518]/30" />
          <div>
            <h1 className="text-white font-bold text-sm">{compteVendeur.nom_complet}</h1>
            <p className="text-slate-400 text-[10px]">Espace Vendeur</p>
          </div>
        </div>
        <button onClick={deconnexion} className="text-slate-400 hover:text-white transition-colors">
          <LogOut className="h-5 w-5" />
        </button>
      </header>

      {/* KYC Pending Banner */}
      {isKycPending && <BanniereKycPending />}

      {/* KYC Required Notice */}
      {isKycRequired && (
        <div className="bg-orange-50 border-y border-orange-100 px-4 py-3">
          <p className="text-sm font-semibold text-orange-800">🔒 Vérification d'identité requise</p>
          <p className="text-xs text-orange-600">Soumettez vos documents KYC pour accéder à toutes les fonctionnalités.</p>
        </div>
      )}

      <div className="p-4 space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <p className="text-xs text-gray-500">Solde Commission</p>
            <p className="text-lg font-bold tabular-nums" style={{ color: "#1a1f5e" }}>{formater(compteVendeur.solde_commission)}</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <p className="text-xs text-gray-500">Ventes totales</p>
            <p className="text-lg font-bold tabular-nums" style={{ color: "#1a1f5e" }}>{formater(compteVendeur.total_ventes)}</p>
          </div>
        </div>

        {/* Quick Actions */}
        {canDoSales && (
          <Link to={createPageUrl("NouvelleCommandeVendeur")}>
            <Button className="w-full h-12 rounded-xl font-bold" style={{ background: "#F5C518", color: "#1a1f5e" }}>
              <Plus className="h-5 w-5 mr-2" /> Nouvelle Commande
            </Button>
          </Link>
        )}

        {/* Menu */}
        <div className="grid grid-cols-3 gap-3">
          {menuItems.map((item) => (
            <Link key={item.page} to={item.disabled ? '#' : createPageUrl(item.page)}
              className={`bg-white rounded-xl p-4 text-center shadow-sm border border-gray-100 transition-all ${item.disabled ? 'opacity-50 pointer-events-none' : 'hover:shadow-md'}`}>
              <item.icon className="h-6 w-6 mx-auto mb-2" style={{ color: "#1a1f5e" }} />
              <span className="text-xs font-medium text-gray-700">{item.label}</span>
            </Link>
          ))}
        </div>

        {/* Recent Orders */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-sm" style={{ color: "#1a1f5e" }}>Commandes récentes</h3>
            <Clock className="h-4 w-4 text-gray-400" />
          </div>
          {commandes.length === 0 ? (
            <p className="p-6 text-center text-sm text-gray-400">Aucune commande pour le moment</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {commandes.slice(0, 5).map((cmd) => {
                const s = STATUTS[cmd.statut] || { label: cmd.statut, couleur: "bg-gray-100 text-gray-700" };
                return (
                  <div key={cmd.id} className="p-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{cmd.client_nom || 'Client'}</p>
                      <p className="text-xs text-gray-400 tabular-nums">{formater(cmd.total)}</p>
                    </div>
                    <span className={`text-[10px] font-medium px-2 py-1 rounded-full ${s.couleur}`}>{s.label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
