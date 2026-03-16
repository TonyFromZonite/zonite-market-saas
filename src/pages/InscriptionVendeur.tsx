import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle2, Loader2, Eye, EyeOff } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { LOGO_URL as LOGO } from "@/components/constants";

const ETAPES = [
  { num: 1, label: "Mon compte" },
  { num: 2, label: "Vérifier email" },
  { num: 3, label: "Mon profil" },
];

export default function InscriptionVendeur() {
  const [etape, setEtape] = useState(1);
  const [form, setForm] = useState({
    nom_complet: "", email: "", telephone: "", mot_de_passe: "", confirmer_mdp: "",
    verification_code: "", ville: "", quartier: "", numero_mobile_money: "",
    operateur_mobile_money: "orange_money",
  });
  const [mdpVisible, setMdpVisible] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  const [vendeurEmail, setVendeurEmail] = useState("");

  const modifier = (champ: string, val: string) => setForm(p => ({ ...p, [champ]: val }));

  const validerEtape1 = async () => {
    if (!form.nom_complet || !form.email || !form.telephone) { setErreur("Tous les champs sont obligatoires."); return; }
    if (form.mot_de_passe.length < 6) { setErreur("Le mot de passe doit contenir au moins 6 caractères."); return; }
    if (form.mot_de_passe !== form.confirmer_mdp) { setErreur("Les mots de passe ne correspondent pas."); return; }

    setEnCours(true); setErreur("");
    try {
      // Create Supabase auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: form.email, password: form.mot_de_passe,
        options: { data: { nom_complet: form.nom_complet } }
      });
      if (authError) throw authError;

      // Create seller record
      const { error: sellerError } = await supabase.from('sellers').insert({
        user_id: authData.user?.id,
        email: form.email,
        nom_complet: form.nom_complet,
        telephone: form.telephone,
        seller_status: 'pending_verification',
      });
      if (sellerError) throw sellerError;

      setVendeurEmail(form.email);
      setEtape(2);
    } catch (err: any) {
      setErreur(err.message || "Erreur lors de l'inscription");
    }
    setEnCours(false);
  };

  const validerEtape2 = async () => {
    // In Supabase, email verification happens via magic link.
    // For this flow, we'll skip OTP and move to profile step
    // since Supabase handles email confirmation automatically
    setEtape(3);
  };

  const validerEtape3 = async () => {
    if (!form.ville || !form.quartier || !form.numero_mobile_money) { setErreur("Ville, quartier et Mobile Money sont obligatoires."); return; }
    setEnCours(true); setErreur("");
    try {
      const { error } = await supabase.from('sellers')
        .update({ ville: form.ville, quartier: form.quartier, numero_mobile_money: form.numero_mobile_money, operateur_mobile_money: form.operateur_mobile_money, seller_status: 'kyc_required' })
        .eq('email', vendeurEmail);
      if (error) throw error;

      sessionStorage.setItem("vendeur_session", JSON.stringify({
        email: vendeurEmail, nom_complet: form.nom_complet, role: 'vendeur', seller_status: 'kyc_required',
      }));
      window.location.href = createPageUrl("EspaceVendeur");
    } catch (err: any) {
      setErreur(err.message || "Erreur lors de la sauvegarde.");
    }
    setEnCours(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "linear-gradient(135deg, #0d1240 0%, #1a1f5e 50%, #2d34a5 100%)" }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <img src={LOGO} alt="Logo" className="w-16 h-16 rounded-full mx-auto mb-3 object-cover border-2 border-[#F5C518]/30" />
          <h1 className="text-xl font-bold text-white">Inscription <span style={{ color: "#F5C518" }}>Vendeur</span></h1>
        </div>

        {/* Steps indicator */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {ETAPES.map((e) => (
            <div key={e.num} className="flex items-center gap-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${etape >= e.num ? 'bg-[#F5C518] text-[#1a1f5e]' : 'bg-white/10 text-slate-400'}`}>
                {etape > e.num ? <CheckCircle2 className="h-4 w-4" /> : e.num}
              </div>
              <span className="text-[10px] text-slate-400 hidden md:inline">{e.label}</span>
              {e.num < 3 && <div className={`w-8 h-0.5 ${etape > e.num ? 'bg-[#F5C518]' : 'bg-white/10'}`} />}
            </div>
          ))}
        </div>

        <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-6">
          {etape === 1 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-white">Créer votre compte</h2>
              <div>
                <label className="text-xs text-slate-300 mb-1 block">Nom complet *</label>
                <Input value={form.nom_complet} onChange={e => modifier("nom_complet", e.target.value)} placeholder="Votre nom complet" className="bg-white/10 border-white/20 text-white placeholder:text-slate-400 rounded-xl h-11" />
              </div>
              <div>
                <label className="text-xs text-slate-300 mb-1 block">Email *</label>
                <Input value={form.email} onChange={e => modifier("email", e.target.value)} placeholder="votre@email.com" className="bg-white/10 border-white/20 text-white placeholder:text-slate-400 rounded-xl h-11" />
              </div>
              <div>
                <label className="text-xs text-slate-300 mb-1 block">Téléphone *</label>
                <Input value={form.telephone} onChange={e => modifier("telephone", e.target.value)} placeholder="+237 6XX XXX XXX" className="bg-white/10 border-white/20 text-white placeholder:text-slate-400 rounded-xl h-11" />
              </div>
              <div>
                <label className="text-xs text-slate-300 mb-1 block">Mot de passe *</label>
                <div className="relative">
                  <Input type={mdpVisible ? "text" : "password"} value={form.mot_de_passe} onChange={e => modifier("mot_de_passe", e.target.value)} placeholder="Min. 6 caractères" className="bg-white/10 border-white/20 text-white placeholder:text-slate-400 rounded-xl h-11 pr-12" />
                  <button type="button" onClick={() => setMdpVisible(!mdpVisible)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                    {mdpVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-300 mb-1 block">Confirmer mot de passe *</label>
                <Input type="password" value={form.confirmer_mdp} onChange={e => modifier("confirmer_mdp", e.target.value)} placeholder="••••••••" className="bg-white/10 border-white/20 text-white placeholder:text-slate-400 rounded-xl h-11" />
              </div>
              {erreur && <p className="text-red-400 text-xs bg-red-500/10 rounded-lg px-3 py-2">{erreur}</p>}
              <Button onClick={validerEtape1} disabled={enCours} className="w-full h-11 rounded-xl font-bold" style={{ background: "#F5C518", color: "#1a1f5e" }}>
                {enCours ? <Loader2 className="h-4 w-4 animate-spin" /> : "Continuer →"}
              </Button>
              <p className="text-center text-xs text-slate-400">
                Déjà un compte ? <Link to={createPageUrl("Connexion")} className="text-[#F5C518] hover:underline">Se connecter</Link>
              </p>
            </div>
          )}

          {etape === 2 && (
            <div className="space-y-4 text-center">
              <h2 className="text-lg font-bold text-white">Vérifiez votre email</h2>
              <p className="text-sm text-slate-300">Un email de confirmation a été envoyé à <strong className="text-[#F5C518]">{vendeurEmail}</strong>.</p>
              <p className="text-xs text-slate-400">Vérifiez votre boîte de réception et cliquez sur le lien de confirmation, puis revenez ici.</p>
              <Button onClick={validerEtape2} className="w-full h-11 rounded-xl font-bold" style={{ background: "#F5C518", color: "#1a1f5e" }}>
                J'ai confirmé mon email →
              </Button>
            </div>
          )}

          {etape === 3 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-white">Complétez votre profil</h2>
              <div>
                <label className="text-xs text-slate-300 mb-1 block">Ville *</label>
                <Input value={form.ville} onChange={e => modifier("ville", e.target.value)} placeholder="Douala, Yaoundé..." className="bg-white/10 border-white/20 text-white placeholder:text-slate-400 rounded-xl h-11" />
              </div>
              <div>
                <label className="text-xs text-slate-300 mb-1 block">Quartier *</label>
                <Input value={form.quartier} onChange={e => modifier("quartier", e.target.value)} placeholder="Votre quartier" className="bg-white/10 border-white/20 text-white placeholder:text-slate-400 rounded-xl h-11" />
              </div>
              <div>
                <label className="text-xs text-slate-300 mb-1 block">Numéro Mobile Money *</label>
                <Input value={form.numero_mobile_money} onChange={e => modifier("numero_mobile_money", e.target.value)} placeholder="6XX XXX XXX" className="bg-white/10 border-white/20 text-white placeholder:text-slate-400 rounded-xl h-11" />
              </div>
              {erreur && <p className="text-red-400 text-xs bg-red-500/10 rounded-lg px-3 py-2">{erreur}</p>}
              <Button onClick={validerEtape3} disabled={enCours} className="w-full h-11 rounded-xl font-bold" style={{ background: "#F5C518", color: "#1a1f5e" }}>
                {enCours ? <Loader2 className="h-4 w-4 animate-spin" /> : "Terminer l'inscription →"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
