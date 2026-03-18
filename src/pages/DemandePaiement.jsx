import React, { useState, useEffect } from "react";
import { getVendeurSession } from "@/components/useSessionGuard";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, Loader2, ChevronLeft, Wallet, AlertCircle } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import BanniereKycPending from "@/components/BanniereKycPending";
import { filterTable } from "@/lib/supabaseHelpers";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

const STATUTS_PAIEMENT = {
  en_attente: { label: "En attente", couleur: "bg-yellow-100 text-yellow-800" },
  paye: { label: "Payé ✓", couleur: "bg-emerald-100 text-emerald-800" },
  payee: { label: "Payé ✓", couleur: "bg-emerald-100 text-emerald-800" },
  rejete: { label: "Rejeté", couleur: "bg-red-100 text-red-800" },
  rejetee: { label: "Rejeté", couleur: "bg-red-100 text-red-800" },
};

export default function DemandePaiement() {
  const [compteVendeur, setCompteVendeur] = useState(null);
  const [form, setForm] = useState({ montant: "", numero_mobile_money: "", operateur: "Orange Money", nom_titulaire: "" });
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [succes, setSucces] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const charger = async () => {
      // Use async session guard to handle missing/stale sessions
      const { getVendeurSessionAsync } = await import("@/components/useSessionGuard");
      const session = await getVendeurSessionAsync();
      if (!session?.id) { window.location.href = createPageUrl("Connexion"); return; }
      
      // Always load FRESH seller data from DB for balance
      const { data: freshSeller } = await supabase
        .from("sellers")
        .select("*")
        .eq("id", session.id)
        .maybeSingle();
      
      const seller = freshSeller || session;
      setCompteVendeur(seller);
      setForm(f => ({
        ...f,
        numero_mobile_money: seller.numero_mobile_money || "",
        operateur: seller.operateur_mobile_money === "mtn_momo" ? "MTN MoMo" : seller.operateur_mobile_money === "orange_money" ? "Orange Money" : seller.operateur_mobile_money || "Orange Money",
        nom_titulaire: seller.full_name || "",
      }));
    };
    charger();
  }, []);

  const { data: demandes = [] } = useQuery({
    queryKey: ["demandes_paiement", compteVendeur?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("demandes_paiement_vendeur")
        .select("*")
        .eq("vendeur_id", compteVendeur.id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) { console.error(error); return []; }
      return data || [];
    },
    enabled: !!compteVendeur?.id,
  });

  const formater = n => `${Math.round(n || 0).toLocaleString("fr-FR")} FCFA`;
  const formaterDate = d => d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

  const soumettre = async () => {
    const montant = parseFloat(form.montant);
    if (!montant || montant < 5000) return setErreur("Montant minimum : 5 000 FCFA");
    if (montant > (compteVendeur.solde_commission || 0)) return setErreur("Montant supérieur à votre solde disponible");
    if (!form.numero_mobile_money) return setErreur("Renseignez votre numéro Mobile Money");
    if (!form.nom_titulaire) return setErreur("Renseignez le nom du titulaire du compte");

    setEnCours(true);
    setErreur("");

    try {
      // Check no pending request exists
      const { data: existingRequest } = await supabase
        .from("demandes_paiement_vendeur")
        .select("id")
        .eq("vendeur_id", compteVendeur.id)
        .eq("statut", "en_attente")
        .maybeSingle();

      if (existingRequest) {
        throw new Error("Vous avez déjà une demande en cours de traitement. Attendez qu'elle soit traitée avant d'en faire une nouvelle.");
      }

      // Get fresh seller data
      const { data: freshSeller } = await supabase
        .from("sellers")
        .select("solde_commission, solde_en_attente")
        .eq("id", compteVendeur.id)
        .single();

      const soldeDisponible = Number(freshSeller?.solde_commission || 0);
      if (montant > soldeDisponible) {
        throw new Error(`Montant supérieur à votre solde disponible (${soldeDisponible.toLocaleString("fr-FR")} FCFA)`);
      }

      // Create payment request
      const { data: demande, error } = await supabase
        .from("demandes_paiement_vendeur")
        .insert({
          vendeur_id: compteVendeur.id,
          vendeur_email: compteVendeur.email,
          montant,
          numero_mobile_money: form.numero_mobile_money,
          operateur_mobile_money: form.operateur,
          statut: "en_attente",
          notes: form.nom_titulaire ? `Titulaire: ${form.nom_titulaire}` : null,
        })
        .select()
        .single();

      if (error) throw error;

      // TEMPORARILY deduct from balance
      await supabase.from("sellers").update({
        solde_commission: soldeDisponible - montant,
        solde_en_attente: Number(freshSeller?.solde_en_attente || 0) + montant,
      }).eq("id", compteVendeur.id);

      // Notify vendor (non-blocking)
      try {
        await supabase.from("notifications_vendeur").insert({
          vendeur_id: compteVendeur.id,
          vendeur_email: compteVendeur.email,
          titre: "⏳ Demande de paiement envoyée",
          message: `Votre demande de retrait de ${montant.toLocaleString("fr-FR")} FCFA a été envoyée.\n\n💳 Opérateur : ${form.operateur}\n📱 Numéro : ${form.numero_mobile_money}\n👤 Titulaire : ${form.nom_titulaire}\n\n💰 Solde temporairement réservé : ${montant.toLocaleString("fr-FR")} FCFA`,
          type: "info",
        });
      } catch (_) {}

      // Notify admin (non-blocking)
      try {
        await supabase.from("notifications_admin").insert({
          titre: "💰 Nouvelle demande de paiement",
          message: `${compteVendeur.full_name} demande un retrait de ${formater(montant)} via ${form.operateur}. Numéro : ${form.numero_mobile_money}. Nom titulaire : ${form.nom_titulaire}`,
          type: "paiement",
          vendeur_email: compteVendeur.email,
          reference_id: demande?.id || null,
        });
      } catch (_) {}

      toast({ title: "✅ Demande envoyée", description: `${montant.toLocaleString("fr-FR")} FCFA en attente de validation.` });
      queryClient.invalidateQueries({ queryKey: ["demandes_paiement"] });
      setEnCours(false);
      setSucces(true);
    } catch (err) {
      setErreur(err.message || "Erreur lors de la soumission");
      setEnCours(false);
    }
  };

  if (succes) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center shadow-lg">
          <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Demande envoyée !</h2>
          <p className="text-sm text-slate-500 mb-4">L'équipe ZONITE traitera votre demande rapidement. Vous serez notifié dès le paiement effectué.</p>
          <Link to={createPageUrl("EspaceVendeur")}><Button className="w-full bg-[#1a1f5e] hover:bg-[#141952]">Retour à l'accueil</Button></Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-8">
      {compteVendeur?.seller_status === "kyc_pending" && <BanniereKycPending />}
      <div className="bg-[#1a1f5e] text-white px-4 pb-6" style={{ paddingTop: "max(1.25rem, env(safe-area-inset-top, 0px))" }}>
        <div className="flex items-center gap-3 mb-4">
          <Link to={createPageUrl("EspaceVendeur")}><ChevronLeft className="w-6 h-6 text-white" /></Link>
          <h1 className="text-lg font-bold">Demander un paiement</h1>
        </div>
        <div className="bg-white/10 rounded-2xl p-4">
          <p className="text-slate-300 text-xs">Solde disponible</p>
          <p className="text-3xl font-bold text-[#F5C518]">{formater(compteVendeur?.solde_commission)}</p>
        </div>
      </div>

      <div className="p-4 space-y-4 max-w-md mx-auto">
        {erreur && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />{erreur}
          </div>
        )}

        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
          <h2 className="font-semibold text-slate-900 text-sm">Nouvelle demande</h2>
          <div className="space-y-1">
            <Label>Montant à retirer (FCFA) *</Label>
            <Input type="number" min="5000" max={compteVendeur?.solde_commission || 0} value={form.montant} onFocus={e => e.target.select()}
              onChange={e => {
                const val = e.target.value;
                const max = compteVendeur?.solde_commission || 0;
                if (val && parseFloat(val) > max) {
                  setForm(f => ({ ...f, montant: String(max) }));
                } else {
                  setForm(f => ({ ...f, montant: val }));
                }
              }} placeholder="Min. 5 000 FCFA" />
            <p className="text-xs text-slate-400">Disponible : {formater(compteVendeur?.solde_commission)}</p>
          </div>
          <div className="space-y-1">
            <Label>Opérateur Mobile Money *</Label>
            <Select value={form.operateur} onValueChange={v => setForm(f => ({ ...f, operateur: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Orange Money">Orange Money</SelectItem>
                <SelectItem value="MTN MoMo">MTN MoMo</SelectItem>
                <SelectItem value="Express Union">Express Union</SelectItem>
                <SelectItem value="Wave">Wave</SelectItem>
                <SelectItem value="Autre">Autre</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Numéro du compte Mobile Money *</Label>
            <Input value={form.numero_mobile_money} onChange={e => setForm(f => ({ ...f, numero_mobile_money: e.target.value }))} placeholder="+237 6XX XXX XXX" />
          </div>
          <div className="space-y-1">
            <Label>Nom du titulaire du compte Mobile Money *</Label>
            <Input
              value={form.nom_titulaire}
              onChange={e => setForm(f => ({ ...f, nom_titulaire: e.target.value }))}
              placeholder="Nom complet du titulaire"
            />
          </div>
          <Button onClick={soumettre} disabled={enCours || (compteVendeur?.solde_commission || 0) < 5000}
            className="w-full bg-[#F5C518] hover:bg-[#e0b010] text-[#1a1f5e] font-bold">
            {enCours ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Wallet className="w-4 h-4 mr-2" />Envoyer la demande</>}
          </Button>
        </div>

        {demandes.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-900 text-sm">Historique des demandes</h3>
            </div>
            {demandes.map(d => (
              <div key={d.id} className="p-4 border-b border-slate-50 last:border-0">
                <div className="flex items-center justify-between mb-1">
                  <p className="font-bold text-slate-900">{formater(d.montant)}</p>
                  <Badge className={`${STATUTS_PAIEMENT[d.statut]?.couleur || 'bg-slate-100 text-slate-800'} border-0 text-xs`}>
                    {STATUTS_PAIEMENT[d.statut]?.label || d.statut}
                  </Badge>
                </div>
                <p className="text-xs text-slate-500">{d.operateur_mobile_money} • {d.numero_mobile_money}</p>
                {d.notes && <p className="text-xs text-slate-400">{d.notes}</p>}
                <p className="text-xs text-slate-400">Demandé le {formaterDate(d.created_at)}</p>
                {d.traite_at && (
                  <p className="text-xs text-slate-400">Traité le {formaterDate(d.traite_at)}{d.traite_par ? ` par ${d.traite_par}` : ""}</p>
                )}
                {d.reference_paiement && (
                  <p className="text-xs text-emerald-600 font-medium mt-1">Réf: {d.reference_paiement}</p>
                )}
                {d.motif_rejet && (
                  <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-xs text-red-700 font-semibold">Motif du rejet :</p>
                    <p className="text-xs text-red-600">{d.motif_rejet}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
