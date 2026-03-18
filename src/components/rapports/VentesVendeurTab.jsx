import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Search, DollarSign, ShoppingCart, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const fmt = (n) => `${Math.round(n || 0).toLocaleString("fr-FR")} FCFA`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const PERIODES = [
  { label: "7 jours", valeur: 7 },
  { label: "30 jours", valeur: 30 },
  { label: "90 jours", valeur: 90 },
  { label: "1 an", valeur: 365 },
  { label: "Tout", valeur: 0 },
];

export default function VentesVendeurTab() {
  const [periodeJours, setPeriodeJours] = useState(30);
  const [filtreVendeur, setFiltreVendeur] = useState("tous");
  const [recherche, setRecherche] = useState("");

  // Use ventes table (actual sales) + sellers for vendor names
  const { data: ventes = [], isLoading: chargVentes } = useQuery({
    queryKey: ["ventes_vendeur_tab"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ventes")
        .select("id, vendeur_id, vendeur_email, produit_id, quantite, montant_total, commission_vendeur, prix_final_client, prix_gros, marge_zonite, profit_zonite, created_at")
        .order("created_at", { ascending: false })
        .limit(2000);
      if (error) { console.error(error); return []; }
      return data || [];
    },
    refetchInterval: 10000,
    refetchOnWindowFocus: true,
  });

  const { data: produits = [] } = useQuery({
    queryKey: ["produits_rapport"],
    queryFn: async () => {
      const { data, error } = await supabase.from("produits").select("id, nom");
      if (error) return [];
      return data || [];
    },
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
  });

  const { data: sellers = [] } = useQuery({
    queryKey: ["sellers_noms_rapport"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sellers").select("id, full_name, email, ville");
      if (error) return [];
      return data || [];
    },
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
  });

  const isLoading = chargVentes;

  const getSellerName = (vendeur_id) => {
    const s = sellers.find(s => s.id === vendeur_id);
    return s?.full_name || "—";
  };

  const getSellerVille = (vendeur_id) => {
    const s = sellers.find(s => s.id === vendeur_id);
    return s?.ville || "—";
  };

  const getProduitNom = (produit_id) => {
    const p = produits.find(p => p.id === produit_id);
    return p?.nom || "Inconnu";
  };

  // Filtrage par période
  const dateDebut = useMemo(() => {
    if (periodeJours === 0) return null;
    const d = new Date();
    d.setDate(d.getDate() - periodeJours);
    return d;
  }, [periodeJours]);

  const ventesFiltrees = useMemo(() => {
    let result = [...ventes];
    if (dateDebut) result = result.filter(v => new Date(v.created_at) >= dateDebut);
    if (filtreVendeur !== "tous") result = result.filter(v => v.vendeur_id === filtreVendeur);
    if (recherche) {
      const q = recherche.toLowerCase();
      result = result.filter(v =>
        getProduitNom(v.produit_id)?.toLowerCase().includes(q) ||
        getSellerName(v.vendeur_id)?.toLowerCase().includes(q) ||
        v.vendeur_email?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [ventes, dateDebut, filtreVendeur, recherche, sellers, produits]);

  // Liste vendeurs uniques
  const vendeurs = useMemo(() => {
    const map = {};
    ventes.forEach(v => {
      if (v.vendeur_id && !map[v.vendeur_id]) {
        map[v.vendeur_id] = getSellerName(v.vendeur_id);
      }
    });
    return Object.entries(map).map(([id, nom]) => ({ id, nom })).sort((a, b) => a.nom.localeCompare(b.nom));
  }, [ventes, sellers]);

  // KPIs
  const caTotal = ventesFiltrees.reduce((s, v) => s + (v.montant_total || 0), 0);
  const commissionsTotal = ventesFiltrees.reduce((s, v) => s + (v.commission_vendeur || 0), 0);
  const nbVentes = ventesFiltrees.length;

  if (isLoading) return <div className="space-y-3">{Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>;

  return (
    <div className="space-y-5">
      {/* Filtres */}
      <div className="flex flex-col md:flex-row flex-wrap gap-2 md:gap-3 items-start md:items-center">
        <div className="flex gap-1 md:gap-1.5 flex-wrap">
          {PERIODES.map(p => (
            <button key={p.valeur}
              onClick={() => setPeriodeJours(p.valeur)}
              className={`px-2 md:px-3 py-1.5 rounded-lg text-[10px] md:text-xs font-medium transition-colors ${periodeJours === p.valeur ? "bg-[#1a1f5e] text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
              {p.label}
            </button>
          ))}
        </div>
        <select
          value={filtreVendeur}
          onChange={e => setFiltreVendeur(e.target.value)}
          className="w-full md:w-48 h-9 text-xs md:text-sm border border-slate-200 rounded-lg px-2 bg-white"
        >
          <option value="tous">Tous les vendeurs</option>
          {vendeurs.map(v => <option key={v.id} value={v.id}>{v.nom}</option>)}
        </select>
        <div className="relative flex-1 w-full md:w-auto min-w-0 md:min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <Input value={recherche} onChange={e => setRecherche(e.target.value)} placeholder="Rechercher..." className="pl-8 h-9 text-xs md:text-sm w-full" />
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
        <div className="bg-white rounded-xl p-3 md:p-4 shadow-sm border border-slate-100">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center"><ShoppingCart className="w-4 h-4 text-blue-600" /></div>
            <p className="text-[11px] md:text-xs text-slate-500 font-medium truncate">Ventes</p>
          </div>
          <p className="text-xl md:text-2xl font-bold text-slate-900">{nbVentes}</p>
        </div>
        <div className="bg-white rounded-xl p-3 md:p-4 shadow-sm border border-slate-100">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center"><DollarSign className="w-4 h-4 text-purple-600" /></div>
            <p className="text-[11px] md:text-xs text-slate-500 font-medium truncate">CA Total</p>
          </div>
          <p className="text-base md:text-xl font-bold text-slate-900 truncate">{fmt(caTotal)}</p>
        </div>
        <div className="bg-white rounded-xl p-3 md:p-4 shadow-sm border border-slate-100">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 bg-yellow-50 rounded-lg flex items-center justify-center"><TrendingUp className="w-4 h-4 text-yellow-600" /></div>
            <p className="text-[11px] md:text-xs text-slate-500 font-medium truncate">Commissions totales</p>
          </div>
          <p className="text-base md:text-xl font-bold text-yellow-600 truncate">{fmt(commissionsTotal)}</p>
        </div>
      </div>

      {/* Tableau */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        {ventesFiltrees.length === 0 ? (
          <div className="p-10 text-center text-slate-400 text-sm">Aucune vente pour cette période</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs md:text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-[10px] md:text-xs uppercase border-b border-slate-100">
                  <th className="text-left px-2 md:px-4 py-3 font-medium">Date</th>
                  <th className="text-left px-2 md:px-4 py-3 font-medium">Vendeur</th>
                  <th className="text-left px-2 md:px-4 py-3 font-medium">Produit</th>
                  <th className="text-right px-2 md:px-4 py-3 font-medium">Qté</th>
                  <th className="text-right px-2 md:px-4 py-3 font-medium">CA</th>
                  <th className="text-right px-2 md:px-4 py-3 font-medium">Commission</th>
                  <th className="text-left px-2 md:px-4 py-3 font-medium hidden md:table-cell">Ville</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {ventesFiltrees.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-2 md:px-4 py-3 text-slate-500 text-[11px] md:text-xs whitespace-nowrap">{fmtDate(v.created_at)}</td>
                    <td className="px-2 md:px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className="w-6 h-6 rounded-full bg-[#1a1f5e] text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0">
                          {getSellerName(v.vendeur_id).charAt(0).toUpperCase()}
                        </span>
                        <span className="font-medium text-slate-800 text-[11px] md:text-xs truncate max-w-[70px] md:max-w-[100px]">{getSellerName(v.vendeur_id)}</span>
                      </div>
                    </td>
                    <td className="px-2 md:px-4 py-3 text-slate-700 truncate max-w-[70px] md:max-w-[130px] text-[11px] md:text-sm">{getProduitNom(v.produit_id)}</td>
                    <td className="px-2 md:px-4 py-3 text-right text-slate-600 text-xs md:text-sm">{v.quantite}</td>
                    <td className="px-2 md:px-4 py-3 text-right font-semibold text-slate-900 text-xs md:text-sm">{fmt(v.montant_total)}</td>
                    <td className="px-2 md:px-4 py-3 text-right">
                      <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 border font-semibold text-[10px] md:text-xs whitespace-nowrap">
                        {fmt(v.commission_vendeur)}
                      </Badge>
                    </td>
                    <td className="px-2 md:px-4 py-3 text-slate-500 text-xs hidden md:table-cell">{getSellerVille(v.vendeur_id)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 border-t border-slate-200 font-semibold text-xs md:text-sm">
                  <td colSpan={4} className="px-2 md:px-4 py-3 text-slate-600 text-xs md:text-sm">Total ({nbVentes} ventes)</td>
                  <td className="px-2 md:px-4 py-3 text-right text-slate-900 text-xs md:text-sm">{fmt(caTotal)}</td>
                  <td className="px-2 md:px-4 py-3 text-right text-yellow-700 text-xs md:text-sm">{fmt(commissionsTotal)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
