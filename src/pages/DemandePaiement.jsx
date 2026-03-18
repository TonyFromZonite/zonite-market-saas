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
      const session = getVendeurSession();
      if (!session) { window.location.href = createPageUrl("Connexion"); return; }
      const sellers = await filterTable("sellers", { email: session.email });
      if (sellers.length > 0) {
        setCompteVendeur(sellers[0]);
        setForm(f => ({
          ...f,
          numero_mobile_money: sellers[0].numero_mobile_money || "",
          operateur: sellers[0].operateur_mobile_money === "mtn_momo" ? "MTN MoMo" : sellers[0].operateur_mobile_money === "orange_money" ? "Orange Money" : sellers[0].operateur_mobile_money || "Orange Money",
          nom_titulaire: sellers[0].full_name || "",
        }));
      }
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

      await supabase.from("notifications_admin").insert({
        titre: "💰 Demande de paiement",
        message: `${compteVendeur.full_name} demande un retrait de ${formater(montant)} via ${form.operateur}. Numéro : ${form.numero_mobile_money}. Nom titulaire : ${form.nom_titulaire}`,
        type: "paiement",
        vendeur_email: compteVendeur.email,
        reference_id: demande?.id || null,
      }).catch(() => {});

      toast({ title: "✅ Demande envoyée", description: "Votre demande de paiement a été envoyée à l'admin." });
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

        {/* Name matching warning */}
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
          <span className="text-2xl flex-shrink-0">⚠️</span>
          <div>
            <p className="font-bold text-amber-700 text-sm mb-1">Important - Vérifiez votre nom</p>
            <p className="text-xs text-slate-600 leading-relaxed">
              Le paiement sera effectué <strong className="text-amber-700">uniquement si le nom du titulaire du compte Mobile Money est identique à votre nom sur Zonite Market.</strong>
            </p>
            <div className="mt-2 p-2 bg-white/70 rounded-lg text-xs text-slate-700">
              Votre nom sur Zonite Market : <strong className="text-amber-700 ml-1">{compteVendeur?.full_name}</strong>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
          <h2 className="font-semibold text-slate-900 text-sm">Nouvelle demande</h2>
          <div className="space-y-1">
            <Label>Montant à retirer (FCFA) *</Label>
            <Input type="number" min="5000" value={form.montant} onFocus={e => e.target.select()}
              onChange={e => setForm(f => ({ ...f, montant: e.target.value }))} placeholder="Min. 5 000 FCFA" />
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
              placeholder={compteVendeur?.full_name || "Nom complet du titulaire"}
              className={form.nom_titulaire ? (form.nom_titulaire.toLowerCase().trim() === compteVendeur?.full_name?.toLowerCase().trim() ? "border-emerald-400 focus:border-emerald-500" : "border-red-400 focus:border-red-500") : ""}
            />
            {form.nom_titulaire && (
              form.nom_titulaire.toLowerCase().trim() === compteVendeur?.full_name?.toLowerCase().trim() ? (
                <p className="text-xs text-emerald-600 flex items-center gap-1 mt-1">✅ Nom correspondant — votre paiement sera traité</p>
              ) : (
                <p className="text-xs text-red-600 flex items-center gap-1 mt-1">❌ Ce nom ne correspond pas à votre nom Zonite Market ({compteVendeur?.full_name}). Votre paiement pourrait être rejeté.</p>
              )
            )}
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
              <div key={d.id} className="flex items-center justify-between p-4 border-b border-slate-50 last:border-0">
                <div>
                  <p className="font-bold text-slate-900">{formater(d.montant)}</p>
                  <p className="text-xs text-slate-500">{d.operateur_mobile_money} • {d.numero_mobile_money}</p>
                  {d.notes && <p className="text-xs text-slate-400">{d.notes}</p>}
                  <p className="text-xs text-slate-400">{formaterDate(d.created_at)}</p>
                </div>
                <Badge className={`${STATUTS_PAIEMENT[d.statut]?.couleur || 'bg-slate-100 text-slate-800'} border-0 text-xs`}>
                  {STATUTS_PAIEMENT[d.statut]?.label || d.statut}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
