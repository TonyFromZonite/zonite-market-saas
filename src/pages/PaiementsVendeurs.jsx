import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, Wallet, XCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getAdminSession, getSousAdminSession } from "@/components/useSessionGuard";
import { useToast } from "@/components/ui/use-toast";

const STATUTS = {
  en_attente: { label: "En attente", couleur: "bg-yellow-100 text-yellow-800" },
  paye: { label: "Payé ✓", couleur: "bg-emerald-100 text-emerald-800" },
  payee: { label: "Payé ✓", couleur: "bg-emerald-100 text-emerald-800" },
  rejete: { label: "Rejeté", couleur: "bg-red-100 text-red-800" },
  rejetee: { label: "Rejeté", couleur: "bg-red-100 text-red-800" },
};

export default function PaiementsVendeurs() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [processingId, setProcessingId] = useState(null);

  const adminSession = getAdminSession() || getSousAdminSession();

  const { data: demandes = [], isLoading } = useQuery({
    queryKey: ["demandes_paiement_admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("demandes_paiement_vendeur")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) { console.error(error); return []; }
      return data || [];
    },
  });

  // Fetch sellers for cross-reference
  const { data: sellers = [] } = useQuery({
    queryKey: ["sellers_for_payments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sellers")
        .select("id, email, full_name, solde_commission, total_commissions_payees");
      if (error) { console.error(error); return []; }
      return data || [];
    },
  });

  const getSellerForDemande = (demande) => sellers.find(s => s.id === demande.vendeur_id) || null;

  const traiterPaiement = async (demande, action) => {
    setProcessingId(demande.id);
    try {
      const seller = getSellerForDemande(demande);

      if (action === "payer") {
        // 1. Update demande status
        await supabase.from("demandes_paiement_vendeur").update({
          statut: "payee",
          traite_par: adminSession?.email || "admin",
          traite_at: new Date().toISOString(),
        }).eq("id", demande.id);

        // 2. Deduct from vendor balance
        if (seller) {
          await supabase.from("sellers").update({
            solde_commission: Math.max(0, (seller.solde_commission || 0) - demande.montant),
            total_commissions_payees: (seller.total_commissions_payees || 0) + demande.montant,
          }).eq("id", demande.vendeur_id);
        }

        // 3. Create payment record
        await supabase.from("paiements_commission").insert({
          demande_id: demande.id,
          vendeur_id: demande.vendeur_id,
          montant: demande.montant,
          methode_paiement: demande.operateur_mobile_money,
          effectue_par: adminSession?.email || "admin",
          reference_paiement: `PAY-${Date.now()}`,
        });

        // 4. Notify vendor
        const newSolde = seller ? Math.max(0, (seller.solde_commission || 0) - demande.montant) : 0;
        await supabase.from("notifications_vendeur").insert({
          vendeur_id: demande.vendeur_id,
          vendeur_email: demande.vendeur_email,
          titre: "✅ Paiement effectué !",
          message: `Votre retrait de ${demande.montant.toLocaleString("fr-FR")} FCFA via ${demande.operateur_mobile_money} au numéro ${demande.numero_mobile_money}${demande.notes ? ` (${demande.notes})` : ""} a été effectué avec succès. Votre nouveau solde : ${newSolde.toLocaleString("fr-FR")} FCFA`,
          type: "paiement",
        });

        toast({ title: "✅ Paiement marqué comme effectué", description: "Le vendeur a été notifié." });
      } else {
        // Reject
        await supabase.from("demandes_paiement_vendeur").update({
          statut: "rejetee",
          traite_par: adminSession?.email || "admin",
          traite_at: new Date().toISOString(),
        }).eq("id", demande.id);

        await supabase.from("notifications_vendeur").insert({
          vendeur_id: demande.vendeur_id,
          vendeur_email: demande.vendeur_email,
          titre: "❌ Demande de paiement rejetée",
          message: `Votre demande de retrait de ${demande.montant.toLocaleString("fr-FR")} FCFA a été rejetée. Contactez le support pour plus d'informations.`,
          type: "paiement",
        });

        toast({ title: "Demande rejetée", description: "Le vendeur a été notifié." });
      }

      queryClient.invalidateQueries({ queryKey: ["demandes_paiement_admin"] });
      queryClient.invalidateQueries({ queryKey: ["sellers_for_payments"] });
    } catch (err) {
      console.error("Erreur traitement paiement:", err);
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    }
    setProcessingId(null);
  };

  const formater = n => `${Math.round(n || 0).toLocaleString("fr-FR")} FCFA`;
  const formaterDate = d => d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

  if (isLoading) return <div className="space-y-3">{Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>;

  const enAttente = demandes.filter(d => d.statut === "en_attente");
  const traitees = demandes.filter(d => d.statut !== "en_attente");
  const totalEnAttente = enAttente.reduce((s, d) => s + (d.montant || 0), 0);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
          <div className="p-3 bg-yellow-50 rounded-xl"><Wallet className="w-5 h-5 text-yellow-600" /></div>
          <div>
            <p className="text-sm text-slate-500">À payer maintenant</p>
            <p className="text-xl font-bold text-yellow-600">{formater(totalEnAttente)}</p>
            <p className="text-xs text-slate-400">{enAttente.length} demande{enAttente.length > 1 ? "s" : ""}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
          <div className="p-3 bg-emerald-50 rounded-xl"><CheckCircle2 className="w-5 h-5 text-emerald-600" /></div>
          <div>
            <p className="text-sm text-slate-500">Total payé</p>
            <p className="text-xl font-bold text-emerald-600">{formater(traitees.filter(d => d.statut === "paye" || d.statut === "payee").reduce((s, d) => s + d.montant, 0))}</p>
          </div>
        </div>
      </div>

      {enAttente.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-4 border-b bg-yellow-50 border-yellow-100">
            <h3 className="font-semibold text-slate-900">💰 Demandes à traiter ({enAttente.length})</h3>
          </div>
          <div className="divide-y divide-slate-100">
            {enAttente.map(d => {
              const seller = getSellerForDemande(d);
              return (
                <div key={d.id} className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <p className="font-bold text-lg text-slate-900">{formater(d.montant)}</p>
                      <p className="text-sm text-slate-700 font-medium">Vendeur : {seller?.full_name || d.vendeur_email}</p>
                      <p className="text-sm text-slate-600">Opérateur : {d.operateur_mobile_money}</p>
                      <p className="text-sm text-slate-600">Numéro : {d.numero_mobile_money}</p>
                      {d.notes && <p className="text-sm text-slate-600">{d.notes}</p>}
                      <p className="text-xs text-slate-400">Date demande : {formaterDate(d.created_at)}</p>
                      <Badge className="bg-yellow-100 text-yellow-800 border-0 text-xs mt-1">En attente</Badge>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <Button
                        size="sm"
                        onClick={() => traiterPaiement(d, "payer")}
                        disabled={processingId === d.id}
                        className="bg-emerald-600 hover:bg-emerald-700"
                      >
                        {processingId === d.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle2 className="w-4 h-4 mr-1" /> Marquer comme payé</>}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => traiterPaiement(d, "rejeter")}
                        disabled={processingId === d.id}
                        className="text-red-600 border-red-200 hover:bg-red-50"
                      >
                        <XCircle className="w-4 h-4 mr-1" /> Rejeter
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {traitees.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-100">
            <h3 className="font-semibold text-slate-900">Historique ({traitees.length})</h3>
          </div>
          <div className="divide-y divide-slate-100">
            {traitees.map(d => {
              const seller = getSellerForDemande(d);
              return (
                <div key={d.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <p className="font-bold">{formater(d.montant)}</p>
                    <p className="text-sm text-slate-600">{seller?.full_name || d.vendeur_email} • {d.operateur_mobile_money}</p>
                    <p className="text-xs text-slate-500">{d.numero_mobile_money}</p>
                    {d.notes && <p className="text-xs text-slate-400">{d.notes}</p>}
                    <p className="text-xs text-slate-400">{formaterDate(d.created_at)}{d.traite_at ? ` → Traité: ${formaterDate(d.traite_at)}` : ""}</p>
                    {d.traite_par && <p className="text-xs text-slate-400">Par : {d.traite_par}</p>}
                  </div>
                  <Badge className={`${STATUTS[d.statut]?.couleur || 'bg-slate-100 text-slate-800'} border-0`}>{STATUTS[d.statut]?.label || d.statut}</Badge>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {demandes.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">Aucune demande de paiement</div>
      )}
    </div>
  );
}
