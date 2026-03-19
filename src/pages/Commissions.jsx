import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Wallet, DollarSign } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";

export default function Commissions() {
  const { data: vendeurs = [], isLoading: chargementVendeurs } = useQuery({
    queryKey: ["vendeurs"],
    queryFn: async () => {
      const { data } = await supabase.from("sellers").select("*").order("created_at", { ascending: false });
      return data || [];
    },
    refetchInterval: 15 * 1000,
    refetchOnWindowFocus: true,
  });

  const { data: paiements = [], isLoading: chargementPaiements } = useQuery({
    queryKey: ["paiements_commissions"],
    queryFn: async () => {
      const { data } = await supabase
        .from("paiements_commission")
        .select("*, sellers!paiements_commission_vendeur_id_fkey(full_name)")
        .order("created_at", { ascending: false })
        .limit(100);
      return data || [];
    },
  });

  const formater = (n) => `${Math.round(n || 0).toLocaleString("fr-FR")} FCFA`;
  const formaterDate = (d) => d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "—";

  const totalAPayer = vendeurs.reduce((s, v) => s + (v.solde_commission || 0), 0);
  const totalEnAttente = vendeurs.reduce((s, v) => s + (v.solde_en_attente || 0), 0);

  if (chargementVendeurs || chargementPaiements) {
    return <div className="space-y-3">{Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>;
  }

  return (
    <div className="space-y-6">
      {/* Résumé */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-yellow-50"><Wallet className="w-5 h-5 text-yellow-600" /></div>
            <div>
              <p className="text-sm text-slate-500">Soldes disponibles</p>
              <p className="text-xl font-bold text-slate-900">{formater(totalAPayer)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-orange-50"><Wallet className="w-5 h-5 text-orange-600" /></div>
            <div>
              <p className="text-sm text-slate-500">En attente validation</p>
              <p className="text-xl font-bold text-orange-600">{formater(totalEnAttente)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-emerald-50"><DollarSign className="w-5 h-5 text-emerald-600" /></div>
            <div>
              <p className="text-sm text-slate-500">Total Payé</p>
              <p className="text-xl font-bold text-slate-900">
                {formater(vendeurs.reduce((s, v) => s + (v.total_commissions_payees || 0), 0))}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-blue-50"><DollarSign className="w-5 h-5 text-blue-600" /></div>
            <div>
              <p className="text-sm text-slate-500">Total Gagné</p>
              <p className="text-xl font-bold text-slate-900">
                {formater(vendeurs.reduce((s, v) => s + (v.total_commissions_gagnees || 0), 0))}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Info banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700">
        ℹ️ Les paiements de commissions se font via la page <strong>Paiements Vendeurs</strong>. Les vendeurs soumettent leurs demandes de retrait, et l'admin les approuve ou les rejette depuis cette interface.
      </div>

      {/* Soldes vendeurs */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200">
          <h3 className="font-semibold text-slate-900">Soldes des Vendeurs</h3>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead>Vendeur</TableHead>
                <TableHead className="text-right">Gagné</TableHead>
                <TableHead className="text-right">Payé</TableHead>
                <TableHead className="text-right">En attente</TableHead>
                <TableHead className="text-right">Solde disponible</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vendeurs.filter(v => v.seller_status === "active_seller").map((v) => (
                <TableRow key={v.id} className="hover:bg-slate-50">
                  <TableCell className="font-medium">{v.full_name}</TableCell>
                  <TableCell className="text-right text-sm">{formater(v.total_commissions_gagnees)}</TableCell>
                  <TableCell className="text-right text-sm">{formater(v.total_commissions_payees)}</TableCell>
                  <TableCell className="text-right text-sm">
                    {Number(v.solde_en_attente || 0) > 0 && (
                      <span className="text-orange-600 font-medium">{formater(v.solde_en_attente)}</span>
                    )}
                    {!Number(v.solde_en_attente || 0) && <span className="text-slate-400">—</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className={`font-bold ${(v.solde_commission || 0) > 0 ? "text-yellow-600" : "text-emerald-600"}`}>
                      {formater(v.solde_commission)}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Historique des paiements */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200">
          <h3 className="font-semibold text-slate-900">Historique des Paiements</h3>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead>Date</TableHead>
                <TableHead>Vendeur</TableHead>
                <TableHead className="text-right">Montant</TableHead>
                <TableHead>Méthode</TableHead>
                <TableHead>Référence</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paiements.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center py-6 text-slate-400">Aucun paiement enregistré</TableCell></TableRow>
              )}
              {paiements.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="text-sm">{formaterDate(p.created_at)}</TableCell>
                  <TableCell className="font-medium">{p.sellers?.full_name || "—"}</TableCell>
                  <TableCell className="text-right font-bold text-emerald-600">{formater(p.montant)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs capitalize">
                      {p.methode_paiement?.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-slate-500">{p.reference_paiement || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}