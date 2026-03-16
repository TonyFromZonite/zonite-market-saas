import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { DollarSign, ShoppingCart, Package, Users, ShieldCheck } from "lucide-react";
import { getAdminSession, getSousAdminSession } from "@/components/useSessionGuard";

const formaterMontant = (n: number) => `${Math.round(n || 0).toLocaleString("fr-FR")} FCFA`;

export default function TableauDeBord() {
  const [stats, setStats] = useState<any>(null);
  const [chargement, setChargement] = useState(true);
  const adminSession = getAdminSession();
  const sousAdmin = getSousAdminSession();

  useEffect(() => {
    if (!adminSession && !sousAdmin) {
      window.location.href = createPageUrl("Connexion");
      return;
    }
    chargerStats();
  }, []);

  const chargerStats = async () => {
    try {
      const [venteRes, prodRes, vendeurRes, cmdRes] = await Promise.all([
        supabase.from('ventes').select('total'),
        supabase.from('produits').select('id', { count: 'exact' }),
        supabase.from('sellers').select('id', { count: 'exact' }).eq('role', 'user'),
        supabase.from('commandes_vendeur').select('id, total, statut'),
      ]);

      const totalVentes = (venteRes.data || []).reduce((sum: number, v: any) => sum + (v.total || 0), 0);
      const cmdEnAttente = (cmdRes.data || []).filter((c: any) => c.statut === 'en_attente_validation_admin').length;
      const totalCommandes = (cmdRes.data || []).reduce((sum: number, c: any) => sum + (c.total || 0), 0);

      setStats({
        totalVentes,
        totalCommandes,
        nombreProduits: prodRes.count || 0,
        nombreVendeurs: vendeurRes.count || 0,
        cmdEnAttente,
      });
    } catch (err) {
      console.error('Erreur chargement stats:', err);
    }
    setChargement(false);
  };

  if (chargement) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold" style={{ color: "#1a1f5e" }}>Tableau de Bord</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
      </div>
    );
  }

  const cartes = [
    { label: "Ventes totales", valeur: formaterMontant(stats?.totalVentes), icon: DollarSign, couleur: "bg-emerald-50 text-emerald-700", iconBg: "bg-emerald-100" },
    { label: "Commandes vendeurs", valeur: formaterMontant(stats?.totalCommandes), icon: ShoppingCart, couleur: "bg-blue-50 text-blue-700", iconBg: "bg-blue-100" },
    { label: "Produits", valeur: stats?.nombreProduits, icon: Package, couleur: "bg-purple-50 text-purple-700", iconBg: "bg-purple-100" },
    { label: "Vendeurs", valeur: stats?.nombreVendeurs, icon: Users, couleur: "bg-orange-50 text-orange-700", iconBg: "bg-orange-100" },
  ];

  return (
    <div className="space-y-6 animate-slide-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" style={{ color: "#1a1f5e" }}>Tableau de Bord</h1>
        {adminSession && (
          <span className="flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
            <ShieldCheck className="h-3 w-3" /> Admin
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cartes.map((c, i) => (
          <div key={i} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow" style={{ boxShadow: "0 0 0 1px rgba(0,0,0,.05), 0 2px 4px rgba(0,0,0,.05)" }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-500">{c.label}</span>
              <div className={`p-2 rounded-lg ${c.iconBg}`}>
                <c.icon className="h-4 w-4" />
              </div>
            </div>
            <div className="text-xl font-bold tabular-nums" style={{ color: "#1a1f5e" }}>{c.valeur}</div>
          </div>
        ))}
      </div>

      {stats?.cmdEnAttente > 0 && (
        <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="font-semibold text-yellow-800">{stats.cmdEnAttente} commande(s) en attente</p>
            <p className="text-sm text-yellow-600">Des commandes vendeurs nécessitent votre validation.</p>
          </div>
          <Link to={createPageUrl("CommandesVendeurs")} className="text-sm font-medium text-yellow-800 hover:underline">
            Voir →
          </Link>
        </div>
      )}
    </div>
  );
}
