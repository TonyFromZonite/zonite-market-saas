import React, { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import PullToRefresh from "@/components/PullToRefresh";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Wallet, DollarSign, Plus, Minus, Pencil } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { subscribeToTable } from "@/lib/supabaseHelpers";

export default function Commissions() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [ajustVendeur, setAjustVendeur] = useState(null);

  useEffect(() => {
    const refreshCommissions = () => {
      queryClient.invalidateQueries({ queryKey: ["vendeurs"] });
      queryClient.invalidateQueries({ queryKey: ["paiements_commissions"] });
      queryClient.invalidateQueries({ queryKey: ["ajustements_commission"] });
    };

    const unsubscribeSellers = subscribeToTable("sellers", refreshCommissions);
    const unsubscribeCommandes = subscribeToTable("commandes_vendeur", refreshCommissions);
    const unsubscribeAjust = subscribeToTable("ajustements_commission", refreshCommissions);

    return () => {
      unsubscribeSellers?.();
      unsubscribeCommandes?.();
      unsubscribeAjust?.();
    };
  }, [queryClient]);

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

  const { data: ajustements = [] } = useQuery({
    queryKey: ["ajustements_commission"],
    queryFn: async () => {
      const { data } = await supabase
        .from("ajustements_commission")
        .select("*, sellers:vendeur_id(full_name)")
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
    <PullToRefresh onRefresh={() => queryClient.invalidateQueries()}>
    <>
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
                <TableHead className="text-right">Action</TableHead>
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
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => setAjustVendeur(v)}>
                      <Pencil className="w-3.5 h-3.5 mr-1" /> Ajuster
                    </Button>
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

      {/* Historique des ajustements */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200">
          <h3 className="font-semibold text-slate-900">Historique des Ajustements</h3>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead>Date</TableHead>
                <TableHead>Vendeur</TableHead>
                <TableHead className="text-right">Montant</TableHead>
                <TableHead>Motif</TableHead>
                <TableHead>Par</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ajustements.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center py-6 text-slate-400">Aucun ajustement enregistré</TableCell></TableRow>
              )}
              {ajustements.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="text-sm">{formaterDate(a.created_at)}</TableCell>
                  <TableCell className="font-medium">{a.sellers?.full_name || "—"}</TableCell>
                  <TableCell className={`text-right font-bold ${Number(a.montant) >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {Number(a.montant) >= 0 ? "+" : "−"}{formater(Math.abs(Number(a.montant)))}
                  </TableCell>
                  <TableCell className="text-sm max-w-xs truncate" title={a.motif}>{a.motif}</TableCell>
                  <TableCell className="text-sm text-slate-500">{a.effectue_par || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>

    <DialogAjustement
      vendeur={ajustVendeur}
      onClose={() => setAjustVendeur(null)}
      onSuccess={() => {
        queryClient.invalidateQueries({ queryKey: ["vendeurs"] });
        queryClient.invalidateQueries({ queryKey: ["ajustements_commission"] });
      }}
      toast={toast}
    />
    </>
    </PullToRefresh>
  );
}

function DialogAjustement({ vendeur, onClose, onSuccess, toast }) {
  const [type, setType] = useState("credit");
  const [montant, setMontant] = useState("");
  const [motif, setMotif] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (vendeur) { setType("credit"); setMontant(""); setMotif(""); }
  }, [vendeur]);

  if (!vendeur) return null;

  const montantNum = Number(montant) || 0;
  const delta = type === "credit" ? montantNum : -montantNum;
  const soldeActuel = Number(vendeur.solde_commission || 0);
  const soldeApres = Math.max(0, soldeActuel + delta);
  const formater = (n) => `${Math.round(n || 0).toLocaleString("fr-FR")} FCFA`;

  const handleSubmit = async () => {
    if (montantNum <= 0) { toast({ title: "Montant invalide", description: "Saisissez un montant > 0", variant: "destructive" }); return; }
    if (motif.trim().length < 5) { toast({ title: "Motif requis", description: "Minimum 5 caractères", variant: "destructive" }); return; }
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.rpc("admin_adjust_seller_commission", {
        _seller_id: vendeur.id,
        _delta: delta,
        _motif: motif.trim(),
        _admin_email: user?.email || "admin",
      });
      if (error) throw error;
      toast({ title: "Ajustement effectué", description: `Solde ajusté de ${delta >= 0 ? "+" : "−"}${formater(Math.abs(delta))}.` });
      onSuccess?.();
      onClose();
    } catch (e) {
      toast({ title: "Erreur", description: e.message || "Impossible d'ajuster le solde", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={!!vendeur} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajuster le solde commission</DialogTitle>
          <DialogDescription>{vendeur.full_name} — Solde actuel : <strong>{formater(soldeActuel)}</strong></DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Type d'ajustement</Label>
            <div className="flex gap-2 mt-2">
              <Button type="button" variant={type === "credit" ? "default" : "outline"} className="flex-1" onClick={() => setType("credit")}>
                <Plus className="w-4 h-4 mr-1" /> Créditer
              </Button>
              <Button type="button" variant={type === "debit" ? "default" : "outline"} className="flex-1" onClick={() => setType("debit")}>
                <Minus className="w-4 h-4 mr-1" /> Débiter
              </Button>
            </div>
          </div>
          <div>
            <Label htmlFor="ajust-montant">Montant (FCFA)</Label>
            <Input id="ajust-montant" type="number" min="1" value={montant} onChange={(e) => setMontant(e.target.value)} placeholder="0" />
          </div>
          <div>
            <Label htmlFor="ajust-motif">Motif (visible par le vendeur)</Label>
            <Textarea id="ajust-motif" value={motif} onChange={(e) => setMotif(e.target.value)} placeholder="Ex : Bonus exceptionnel, correction d'erreur, ..." rows={3} />
          </div>
          {montantNum > 0 && (
            <div className="bg-slate-50 rounded-lg p-3 text-sm">
              Nouveau solde : <strong className={delta >= 0 ? "text-emerald-600" : "text-red-600"}>{formater(soldeApres)}</strong>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>Annuler</Button>
          <Button onClick={handleSubmit} disabled={submitting}>{submitting ? "Traitement..." : "Confirmer"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}