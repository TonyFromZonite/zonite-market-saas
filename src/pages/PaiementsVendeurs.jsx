import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
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
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectingDemande, setRejectingDemande] = useState(null);
  const [rejectReason, setRejectReason] = useState("");

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

  const { data: sellers = [] } = useQuery({
    queryKey: ["sellers_for_payments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sellers")
        .select("id, email, full_name, solde_commission, solde_en_attente, total_commissions_payees");
      if (error) { console.error(error); return []; }
      return data || [];
    },
  });

  const getSellerForDemande = (demande) => sellers.find(s => s.id === demande.vendeur_id) || null;

  const loadDemandes = () => {
    queryClient.invalidateQueries({ queryKey: ["demandes_paiement_admin"] });
    queryClient.invalidateQueries({ queryKey: ["sellers_for_payments"] });
    queryClient.invalidateQueries({ queryKey: ["vendeurs"] });
    queryClient.invalidateQueries({ queryKey: ["paiements_badge"] });
  };

  // ─── APPROVE PAYMENT (Phase 3 flow) ───
  const approuverPaiement = async (demande) => {
    setProcessingId(demande.id);
    try {
      // Get fresh seller data
      const { data: seller } = await supabase
        .from("sellers")
        .select("id, full_name, email, solde_commission, solde_en_attente, total_commissions_payees")
        .eq("id", demande.vendeur_id)
        .single();

      if (!seller) throw new Error("Vendeur introuvable");
      if (demande.statut !== "en_attente") throw new Error("Cette demande a déjà été traitée");

      const montant = Number(demande.montant);

      // 1. Update demande to payee
      await supabase.from("demandes_paiement_vendeur").update({
        statut: "payee",
        traite_par: adminSession?.email || "admin",
        traite_at: new Date().toISOString(),
      }).eq("id", demande.id);

      // 2. Reset solde_en_attente, keep solde_commission (already deducted in step 1)
      await supabase.from("sellers").update({
        solde_en_attente: Math.max(0, Number(seller.solde_en_attente || 0) - montant),
        total_commissions_payees: Number(seller.total_commissions_payees || 0) + montant,
      }).eq("id", seller.id);

      // 3. Create payment record
      await supabase.from("paiements_commission").insert({
        demande_id: demande.id,
        vendeur_id: seller.id,
        montant,
        methode_paiement: demande.operateur_mobile_money,
        reference_paiement: `PAY-${Date.now().toString(36).toUpperCase()}`,
        effectue_par: adminSession?.email || "admin",
      });

      // 4. Notify vendor
      await supabase.from("notifications_vendeur").insert({
        vendeur_id: seller.id,
        vendeur_email: seller.email,
        titre: "✅ Paiement effectué !",
        message: `Votre retrait de ${montant.toLocaleString("fr-FR")} FCFA a été effectué avec succès !\n\n💳 Opérateur : ${demande.operateur_mobile_money}\n📱 Numéro : ${demande.numero_mobile_money}\n\n💰 Total reçu depuis le début : ${(Number(seller.total_commissions_payees || 0) + montant).toLocaleString("fr-FR")} FCFA\n\nMerci pour votre confiance ! 🎉`,
        type: "succes",
      });

      toast({ title: "✅ Paiement approuvé !", description: `${montant.toLocaleString("fr-FR")} FCFA payé à ${seller.full_name}` });
      loadDemandes();
    } catch (err) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    }
    setProcessingId(null);
  };

  // ─── OPEN REJECT MODAL ───
  const openRejectModal = (demande) => {
    setRejectingDemande(demande);
    setRejectReason("");
    setShowRejectModal(true);
  };

  // ─── REJECT PAYMENT (Phase 3 flow) ───
  const rejeterPaiement = async () => {
    if (!rejectReason.trim()) {
      toast({ title: "⚠️ Motif obligatoire", description: "Vous devez écrire le motif du rejet", variant: "destructive" });
      return;
    }

    setProcessingId(rejectingDemande.id);
    try {
      const { data: seller } = await supabase
        .from("sellers")
        .select("id, full_name, email, solde_commission, solde_en_attente")
        .eq("id", rejectingDemande.vendeur_id)
        .single();

      if (!seller) throw new Error("Vendeur introuvable");

      const montant = Number(rejectingDemande.montant);

      // 1. Update demande to rejetee
      const { error: demandeError } = await supabase.from("demandes_paiement_vendeur").update({
        statut: "rejetee",
        motif_rejet: rejectReason.trim(),
        traite_par: adminSession?.email || "admin",
        traite_at: new Date().toISOString(),
      }).eq("id", rejectingDemande.id);
      if (demandeError) throw new Error("Erreur mise à jour demande: " + demandeError.message);

      // 2. RESTORE vendor balance
      const { error: sellerError } = await supabase.from("sellers").update({
        solde_commission: Number(seller.solde_commission || 0) + montant,
        solde_en_attente: Math.max(0, Number(seller.solde_en_attente || 0) - montant),
      }).eq("id", seller.id);
      if (sellerError) throw new Error("Erreur restauration solde: " + sellerError.message);

      // 3. Notify vendor with exact reason
      await supabase.from("notifications_vendeur").insert({
        vendeur_id: seller.id,
        vendeur_email: seller.email,
        titre: "❌ Demande de paiement rejetée",
        message: `Votre demande de retrait de ${montant.toLocaleString("fr-FR")} FCFA a été rejetée.\n\n📋 Motif du rejet :\n"${rejectReason.trim()}"\n\n✅ Votre solde a été restauré automatiquement.\nNouveau solde disponible : ${(Number(seller.solde_commission || 0) + montant).toLocaleString("fr-FR")} FCFA\n\nVous pouvez faire une nouvelle demande en corrigeant le problème mentionné.`,
        type: "alerte",
      });

      toast({ title: "✅ Demande rejetée", description: `Solde de ${seller.full_name} restauré. Vendeur notifié.` });
      setShowRejectModal(false);
      setRejectingDemande(null);
      setRejectReason("");
      loadDemandes();
    } catch (err) {
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

  const REJECT_SUGGESTIONS = [
    "Nom Mobile Money incorrect",
    "Numéro de compte invalide",
    "Informations incomplètes",
    "Solde insuffisant",
    "Compte non vérifié",
  ];

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
              const nameMatch = d.notes && seller?.full_name
                ? d.notes.replace("Titulaire: ", "").toLowerCase().trim() === seller.full_name.toLowerCase().trim()
                : null;
              return (
                <div key={d.id} className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-1 flex-1 min-w-0">
                      <p className="font-bold text-lg text-slate-900">{formater(d.montant)}</p>
                      <p className="text-sm text-slate-700 font-medium">Vendeur : {seller?.full_name || d.vendeur_email}</p>
                      <p className="text-sm text-slate-500">Email : {d.vendeur_email}</p>
                      <p className="text-sm text-slate-600">💳 Opérateur : <span className="font-medium">{d.operateur_mobile_money}</span></p>
                      <p className="text-sm text-slate-600">📱 Numéro : <span className="font-medium">{d.numero_mobile_money}</span></p>
                      {d.notes && (
                        <p className="text-sm text-slate-600 flex items-center gap-1 flex-wrap">
                          👤 {d.notes}
                          {nameMatch !== null && (
                            nameMatch
                              ? <span className="text-emerald-600 text-xs font-medium ml-1">✅ Nom correspondant</span>
                              : <span className="text-red-600 text-xs font-medium ml-1">❌ Nom différent du profil ({seller?.full_name})</span>
                          )}
                        </p>
                      )}
                      <p className="text-xs text-slate-400">📅 Date demande : {formaterDate(d.created_at)}</p>
                      <Badge className="bg-yellow-100 text-yellow-800 border-0 text-xs mt-1">En attente</Badge>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <Button
                        size="sm"
                        onClick={() => approuverPaiement(d)}
                        disabled={!!processingId}
                        className="bg-emerald-600 hover:bg-emerald-700"
                      >
                        {processingId === d.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle2 className="w-4 h-4 mr-1" /> Marquer comme payé</>}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openRejectModal(d)}
                        disabled={!!processingId}
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
                <div key={d.id} className="p-4 flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                  <div className="space-y-0.5">
                    <p className="font-bold">{formater(d.montant)}</p>
                    <p className="text-sm text-slate-600">{seller?.full_name || d.vendeur_email}</p>
                    <p className="text-sm text-slate-500">💳 {d.operateur_mobile_money} • 📱 {d.numero_mobile_money}</p>
                    {d.notes && <p className="text-xs text-slate-400">👤 {d.notes}</p>}
                    {d.reference_paiement && (
                      <p className="text-xs text-emerald-600 font-medium">Réf: {d.reference_paiement}</p>
                    )}
                    {d.motif_rejet && (
                      <p className="text-xs text-red-600 mt-1">❌ Motif rejet : {d.motif_rejet}</p>
                    )}
                    <p className="text-xs text-slate-400">📅 Demandé : {formaterDate(d.created_at)}{d.traite_at ? ` → Traité : ${formaterDate(d.traite_at)}` : ""}</p>
                    {d.traite_par && <p className="text-xs text-slate-400">Par : {d.traite_par}</p>}
                  </div>
                  <Badge className={`${STATUTS[d.statut]?.couleur || 'bg-slate-100 text-slate-800'} border-0 flex-shrink-0`}>{STATUTS[d.statut]?.label || d.statut}</Badge>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {demandes.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">Aucune demande de paiement</div>
      )}

      {/* Rejection Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-bold text-red-600 mb-1">❌ Rejeter la demande</h3>
            <p className="text-sm text-slate-500 mb-4">Le solde du vendeur sera automatiquement restauré.</p>
            
            <label className="text-sm text-slate-700 font-semibold block mb-2">Motif du rejet * (obligatoire)</label>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {REJECT_SUGGESTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => setRejectReason(s)}
                  className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${rejectReason === s ? "bg-red-100 border-red-300 text-red-700" : "bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200"}`}
                >
                  {s}
                </button>
              ))}
            </div>
            <Textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="Expliquez le motif du rejet au vendeur..."
              rows={3}
              className="mb-4"
            />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => { setShowRejectModal(false); setRejectReason(""); setRejectingDemande(null); }}>
                Annuler
              </Button>
              <Button
                onClick={rejeterPaiement}
                disabled={!rejectReason.trim() || !!processingId}
                className="flex-[2] bg-red-600 hover:bg-red-700 text-white"
              >
                {processingId ? "⏳ Traitement..." : "❌ Confirmer le rejet"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
