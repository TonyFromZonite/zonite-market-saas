import React, { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, Loader2, Upload, Eye, EyeOff, ChevronLeft, XCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { createPageUrl } from "@/utils";
import { LOGO_URL as LOGO } from "@/components/constants";

const ETAPES = [
  { num: 1, label: "Mon compte" },
  { num: 2, label: "Vérifier email" },
  { num: 3, label: "Mon profil" },
];

// Password validation
const validatePassword = (password) => {
  if (password.length < 8) return "Le mot de passe doit avoir au moins 8 caractères";
  if (!/[A-Z]/.test(password)) return "Doit contenir au moins une majuscule";
  if (!/[0-9]/.test(password)) return "Doit contenir au moins un chiffre";
  return null;
};

// Username validation
const validateUsernameFormat = (username) => {
  const clean = username.toLowerCase().trim();
  if (!/^[a-z0-9_]{3,20}$/.test(clean)) {
    return "Nom utilisateur invalide (3-20 caractères, lettres/chiffres/_)";
  }
  return null;
};

export default function InscriptionVendeur() {
  const { toast } = useToast();
  const [etape, setEtape] = useState(1);
  const [typeDocument, setTypeDocument] = useState("cni");
  const [form, setForm] = useState({
    username: "",
    nom_complet: "",
    email: "",
    telephone: "",
    mot_de_passe: "",
    confirmer_mdp: "",
    verification_code: "",
    ville: "",
    quartier: "",
    numero_mobile_money: "",
    operateur_mobile_money: "orange_money",
    experience_vente: "",
  });
  // KYC docs state with previews
  const [kycDocs, setKycDocs] = useState({ recto: null, verso: null, selfie: null, passeport: null });
  const [kycPreviews, setKycPreviews] = useState({ recto: null, verso: null, selfie: null, passeport: null });
  const [kycUploading, setKycUploading] = useState({});

  const [mdpVisible, setMdpVisible] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  const [erreurMdp, setErreurMdp] = useState("");
  const [succes, setSucces] = useState(false);
  const [emailVerifie, setEmailVerifie] = useState(null);
  const [usernameStatus, setUsernameStatus] = useState(null);
  const [vendeurEmail, setVendeurEmail] = useState("");
  const [reenvoyerDisable, setReenvoyerDisable] = useState(false);
  const [sellerId, setSellerId] = useState(null);

  const getRequiredKycDocs = () => {
    if (typeDocument === 'cni') return ['recto', 'verso', 'selfie'];
    if (typeDocument === 'passeport') return ['passeport', 'selfie'];
    return [];
  };
  const allKycDocsUploaded = () => {
    const required = getRequiredKycDocs();
    return required.length > 0 && required.every(k => kycDocs[k] !== null);
  };
  const getLabelForKey = (key) => ({ recto: 'CNI Recto', verso: 'CNI Verso', selfie: 'Selfie avec document', passeport: 'Page photo passeport' }[key] || key);

  const handleKycFileSelect = async (docKey, e) => {
    const file = e.target.files[0];
    if (!file) return;
    setKycUploading(prev => ({ ...prev, [docKey]: true }));
    try {
      if (file.size > 5 * 1024 * 1024) { toast({ title: '❌ Fichier trop volumineux', description: 'Maximum 5MB', variant: 'destructive' }); return; }
      if (!file.type.startsWith('image/')) { toast({ title: '❌ Format invalide', description: 'Seules les images sont acceptées', variant: 'destructive' }); return; }
      const reader = new FileReader();
      reader.onload = (ev) => setKycPreviews(p => ({ ...p, [docKey]: ev.target.result }));
      reader.readAsDataURL(file);
      const fileName = `kyc/${sellerId || vendeurEmail}/${docKey}_${Date.now()}.jpg`;
      const { data, error } = await supabase.storage.from('kyc-documents').upload(fileName, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from('kyc-documents').getPublicUrl(fileName);
      setKycDocs(p => ({ ...p, [docKey]: urlData.publicUrl }));
      toast({ title: '✅ Document ajouté', description: `${getLabelForKey(docKey)} uploadé` });
    } catch (error) {
      toast({ title: '❌ Erreur upload', description: error.message, variant: 'destructive' });
    } finally {
      setKycUploading(p => ({ ...p, [docKey]: false }));
    }
  };

  const modifier = (champ, val) => setForm(p => ({ ...p, [champ]: val }));

  // Debounced username check
  useEffect(() => {
    const username = form.username.toLowerCase().trim();
    if (!username || username.length < 3) {
      setUsernameStatus(null);
      return;
    }
    const formatErr = validateUsernameFormat(username);
    if (formatErr) {
      setUsernameStatus('invalid');
      return;
    }
    setUsernameStatus('checking');
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from('sellers')
        .select('id')
        .eq('username', username)
        .maybeSingle();
      setUsernameStatus(data ? 'taken' : 'available');
    }, 500);
    return () => clearTimeout(timer);
  }, [form.username]);

  // Real-time password validation
  useEffect(() => {
    if (!form.mot_de_passe) { setErreurMdp(""); return; }
    const err = validatePassword(form.mot_de_passe);
    setErreurMdp(err || "");
  }, [form.mot_de_passe]);

  // Email uniqueness check
  const verifierEmail = async (email) => {
    if (!email || !email.includes("@")) { setEmailVerifie(null); return; }
    try {
      const { data } = await supabase
        .from('sellers')
        .select('id')
        .eq('email', email.toLowerCase().trim())
        .maybeSingle();
      setEmailVerifie(!data);
    } catch { setEmailVerifie(null); }
  };

// Reusable KYC document upload component with camera support
function KycDocUpload({ docKey, label, hint, preview, isUploading, doc, onSelect, onClear, isSelfie }) {
  const inputRef = useRef(null);
  return (
    <div>
      <Label className="text-slate-200 text-xs mb-1.5 block">
        {label} <span className="text-red-400">*</span>
      </Label>
      <input ref={inputRef} type="file" accept="image/*" capture={isSelfie ? "user" : "environment"} onChange={(e) => onSelect(docKey, e)} className="hidden" />
      {preview ? (
        <div className="relative">
          <img src={preview} alt={label} className="w-full h-36 object-cover rounded-2xl border-2 border-emerald-400" />
          <div className="absolute top-2 right-2 flex gap-1.5">
            <span className="bg-emerald-500 text-white px-2 py-1 rounded-full text-[10px] font-semibold">✅ OK</span>
            <button onClick={onClear} className="bg-red-500/80 text-white px-2 py-1 rounded-full text-[10px] font-semibold hover:bg-red-600">Changer</button>
          </div>
        </div>
      ) : (
        <div onClick={() => inputRef.current?.click()} className={`flex flex-col items-center justify-center w-full h-28 rounded-2xl border-2 border-dashed cursor-pointer transition-all ${isUploading ? 'border-[#f5a623]/50 bg-[#f5a623]/5' : 'border-white/20 bg-white/5 hover:bg-white/10'}`}>
          {isUploading ? (
            <Loader2 className="w-6 h-6 text-[#f5a623] animate-spin" />
          ) : (
            <>
              <div className="text-3xl mb-2">📷</div>
              <p className="text-white/70 text-xs font-medium">Appuyer pour ouvrir</p>
              <p className="text-white/40 text-[10px]">📷 Caméra ou 🖼️ Galerie</p>
              {hint && <p className="text-[#f5a623]/60 text-[10px] italic mt-1">{hint}</p>}
            </>
          )}
        </div>
      )}
    </div>
  );
}

  const validerEtape1 = async () => {
    // Username validation
    const usernameClean = form.username.toLowerCase().trim();
    const usernameErr = validateUsernameFormat(usernameClean);
    if (usernameErr) { setErreur(usernameErr); return; }
    if (usernameStatus === 'taken') { setErreur("Ce nom d'utilisateur est déjà pris"); return; }
    if (usernameStatus !== 'available') { setErreur("Veuillez choisir un nom d'utilisateur valide"); return; }

    if (!form.nom_complet || !form.email || !form.telephone) {
      setErreur("Nom complet, email et téléphone sont obligatoires."); return;
    }
    if (!form.email.includes("@")) {
      setErreur("L'email saisi n'est pas valide."); return;
    }
    if (emailVerifie === false) {
      setErreur("Cet email est déjà utilisé."); return;
    }
    const pwdErr = validatePassword(form.mot_de_passe);
    if (pwdErr) { setErreur(pwdErr); return; }
    if (form.mot_de_passe !== form.confirmer_mdp) {
      setErreur("Les mots de passe ne correspondent pas."); return;
    }

    setEnCours(true);
    setErreur("");

    try {
      // 1. Sign up via Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: form.email.trim().toLowerCase(),
        password: form.mot_de_passe,
        options: {
          data: {
            role: 'vendeur',
            full_name: form.nom_complet,
          }
        }
      });

      if (authError) {
        if (authError.message.includes('already registered')) {
          setErreur("Cet email est déjà utilisé.");
        } else {
          setErreur(authError.message);
        }
        return;
      }

      // Sign in immediately to guarantee active session for RLS
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: form.email.trim().toLowerCase(),
        password: form.mot_de_passe,
      });
      if (signInError) {
        setErreur("Compte créé mais connexion échouée: " + signInError.message);
        return;
      }

      // 2. Insert into sellers table
      const { data: sellerData, error: sellerError } = await supabase
        .from('sellers')
        .insert({
          user_id: authData.user.id,
          email: form.email.trim().toLowerCase(),
          full_name: form.nom_complet,
          username: usernameClean,
          telephone: form.telephone,
          role: 'user',
          seller_status: 'pending_verification',
        })
        .select('id')
        .single();

      if (sellerError) {
        setErreur("Erreur lors de la création du compte: " + sellerError.message);
        return;
      }

      setSellerId(sellerData.id);

      // 3. Insert user role
      await supabase.from('user_roles').insert({
        user_id: authData.user.id,
        role: 'vendeur',
      });

      // 4. Generate verification code and store it
      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      await supabase.from('sellers').update({
        email_verification_code: verificationCode,
        email_verification_expires_at: expiresAt,
      }).eq('id', sellerData.id);

      // 5. Send verification email via edge function
      try {
        await supabase.functions.invoke('send-verification-email', {
          body: { email: form.email.trim().toLowerCase(), nom: form.nom_complet, code: verificationCode }
        });
      } catch (e) {
        console.warn("Verification email send failed:", e);
      }

      setVendeurEmail(form.email.trim().toLowerCase());
      setEtape(2);
    } catch (error) {
      setErreur(error.message || "Erreur lors de l'inscription");
    } finally {
      setEnCours(false);
    }
  };

  const validerEtape2 = async () => {
    if (!form.verification_code || form.verification_code.length !== 6) {
      setErreur("Veuillez entrer un code à 6 chiffres"); return;
    }
    setEnCours(true);
    setErreur("");

    try {
      // Verify the code against sellers table
      const { data: seller, error } = await supabase
        .from('sellers')
        .select('id, email_verification_code, email_verification_expires_at')
        .eq('email', vendeurEmail)
        .single();

      if (error || !seller) {
        setErreur("Compte introuvable"); return;
      }

      if (seller.email_verification_code !== form.verification_code) {
        setErreur("Code invalide"); return;
      }

      if (seller.email_verification_expires_at && new Date(seller.email_verification_expires_at) < new Date()) {
        setErreur("Code expiré. Demandez un nouveau code."); return;
      }

      // Mark email as verified
      await supabase
        .from('sellers')
        .update({ 
          email_verified: true,
          email_verification_code: null,
          seller_status: 'kyc_required'
        })
        .eq('id', seller.id);

      setSellerId(seller.id);
      setEtape(3);
    } catch (error) {
      setErreur(error.message || "Erreur lors de la vérification");
    } finally {
      setEnCours(false);
    }
  };

  const renvoyerCode = async () => {
    setReenvoyerDisable(true);
    try {
      const newCode = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      await supabase.from('sellers').update({
        email_verification_code: newCode,
        email_verification_expires_at: expiresAt,
      }).eq('email', vendeurEmail);

      await supabase.functions.invoke('send-verification-email', {
        body: { email: vendeurEmail, nom: form.nom_complet, code: newCode }
      });
      setErreur("Code renvoyé par email");
      setTimeout(() => setReenvoyerDisable(false), 30000);
    } catch {
      setErreur("Erreur lors de l'envoi du code");
      setReenvoyerDisable(false);
    }
  };

  const validerEtape3 = async () => {
    if (!form.ville || !form.quartier || !form.numero_mobile_money) {
      setErreur("Ville, quartier et numéro Mobile Money sont obligatoires."); return;
    }
    setEnCours(true);
    setErreur("");

    try {
      const { error } = await supabase
        .from('sellers')
        .update({
          ville: form.ville,
          quartier: form.quartier,
          numero_mobile_money: form.numero_mobile_money,
          operateur_mobile_money: form.operateur_mobile_money,
          experience_vente: form.experience_vente || null,
        })
        .eq('email', vendeurEmail);

      if (error) {
        setErreur("Erreur lors de la sauvegarde du profil: " + error.message);
        return;
      }

      // Set session with seller ID and redirect
      sessionStorage.setItem("vendeur_session", JSON.stringify({
        id: sellerId,
        email: vendeurEmail,
        nom_complet: form.nom_complet,
        role: 'vendeur',
        seller_status: 'kyc_required',
        email_verified: true,
      }));
      window.location.href = createPageUrl("EspaceVendeur");
    } catch (error) {
      setErreur(error.message || "Erreur lors de la sauvegarde du profil.");
    } finally {
      setEnCours(false);
    }
  };

  const soumettre = async () => {
    if (!allKycDocsUploaded()) {
      const missing = getRequiredKycDocs().filter(k => !kycDocs[k]).map(k => getLabelForKey(k));
      setErreur(`Documents manquants : ${missing.join(', ')}`);
      return;
    }
    setEnCours(true);
    setErreur("");

    try {
      const { error } = await supabase
        .from('sellers')
        .update({
          kyc_document_recto_url: kycDocs.recto || null,
          kyc_document_verso_url: kycDocs.verso || null,
          kyc_selfie_url: kycDocs.selfie || null,
          kyc_passeport_url: kycDocs.passeport || null,
          kyc_type_document: typeDocument,
          kyc_document_type: typeDocument,
          statut_kyc: 'en_attente',
          seller_status: 'kyc_pending',
          kyc_submitted_at: new Date().toISOString(),
        })
        .eq('email', vendeurEmail);

      if (error) throw error;

      const { data: sellerData } = await supabase
        .from('sellers')
        .select('id, full_name')
        .eq('email', vendeurEmail)
        .single();

      if (sellerData) {
        await supabase.from('notifications_admin').insert({
          titre: '🪪 Nouveau KYC à valider',
          message: `${sellerData.full_name} (${vendeurEmail}) a soumis son KYC avec ${typeDocument === 'cni' ? 'CNI' : 'Passeport'}. ${getRequiredKycDocs().length} documents fournis.`,
          type: 'kyc',
          vendeur_email: vendeurEmail,
          reference_id: sellerData.id,
        });
      }

      setSucces(true);
    } catch (error) {
      setErreur(error.message || "Erreur lors de la soumission.");
    } finally {
      setEnCours(false);
    }
  };

  if (succes) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0d1240] to-[#1a1f5e] flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-10 h-10 text-emerald-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Inscription réussie ! 🎉</h2>
          <p className="text-sm text-slate-500 mb-3">
            Votre compte a été créé et vos identifiants ont été envoyés par email.
          </p>
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-xs text-yellow-800 mb-5">
            <p className="font-semibold mb-1">⏳ Prochaine étape :</p>
            <p>Notre équipe va vérifier votre dossier KYC sous <strong>24 à 48h</strong>.</p>
          </div>
          <Link to={createPageUrl("Connexion")}>
            <Button className="w-full bg-[#1a1f5e] hover:bg-[#141952]">Me connecter</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0d1240] to-[#1a1f5e] flex flex-col items-center justify-start px-4 py-8"
      style={{ paddingTop: "max(2rem, env(safe-area-inset-top, 0px))" }}>

      {/* Header */}
      <div className="w-full max-w-md flex items-center gap-3 mb-6">
        <Link to={createPageUrl("Connexion")}>
          <button className="w-8 h-8 bg-white/10 rounded-xl flex items-center justify-center">
            <ChevronLeft className="w-5 h-5 text-white" />
          </button>
        </Link>
        <div className="flex items-center gap-2 flex-1">
          <img src={LOGO} alt="Zonite" className="h-8 w-8 rounded-xl object-contain bg-white p-0.5" />
          <div>
            <p className="text-white font-black text-sm leading-none">ZONITE</p>
            <p className="text-[#F5C518] text-[10px] font-semibold tracking-widest">VENDEURS</p>
          </div>
        </div>
      </div>

      <div className="w-full max-w-md">
        <div className="mb-6">
          <h1 className="text-2xl font-black text-white">Créer mon compte vendeur</h1>
          <p className="text-slate-300 text-sm mt-1">Rejoignez le réseau de vente ZONITE</p>
        </div>

        {/* Stepper */}
        <div className="flex items-center gap-1 mb-6">
          {ETAPES.map((e, i) => (
            <React.Fragment key={e.num}>
              <div className="flex flex-col items-center gap-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                  etape > e.num ? "bg-emerald-500 text-white" :
                  etape === e.num ? "bg-[#F5C518] text-[#1a1f5e]" :
                  "bg-white/10 text-slate-400"
                }`}>
                  {etape > e.num ? "✓" : e.num}
                </div>
                <span className={`text-[9px] font-medium whitespace-nowrap ${etape === e.num ? "text-[#F5C518]" : "text-slate-400"}`}>{e.label}</span>
              </div>
              {i < ETAPES.length - 1 && (
                <div className={`flex-1 h-0.5 mb-3 rounded ${etape > e.num ? "bg-emerald-500" : "bg-white/10"}`} />
              )}
            </React.Fragment>
          ))}
        </div>

        {erreur && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-400/30 rounded-xl text-sm text-red-300">{erreur}</div>
        )}

        {/* ÉTAPE 1 : Compte */}
        {etape === 1 && (
          <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-6 border border-white/20 space-y-4">
            <h2 className="text-white font-bold">Mes informations de connexion</h2>
            
            {/* USERNAME - FIRST FIELD */}
            <div>
              <Label className="text-slate-200 text-xs">Nom d'utilisateur * <span className="text-slate-400">(lettres, chiffres, _)</span></Label>
              <div className="relative">
                <Input 
                  value={form.username} 
                  onChange={e => modifier("username", e.target.value.replace(/\s/g, '').toLowerCase())} 
                  placeholder="mon_pseudo" 
                  maxLength={20}
                  className="bg-white/10 border-white/20 text-white placeholder:text-slate-400 rounded-xl h-11 mt-1 pr-10" 
                />
                {form.username.length >= 3 && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 mt-0.5">
                    {usernameStatus === 'checking' && <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />}
                    {usernameStatus === 'available' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                    {(usernameStatus === 'taken' || usernameStatus === 'invalid') && <XCircle className="w-4 h-4 text-red-400" />}
                  </div>
                )}
              </div>
              {form.username.length >= 3 && usernameStatus === 'taken' && (
                <p className="text-red-400 text-xs mt-1">✗ Ce nom d'utilisateur est déjà pris</p>
              )}
              {form.username.length >= 3 && usernameStatus === 'invalid' && (
                <p className="text-red-400 text-xs mt-1">✗ 3-20 caractères, lettres/chiffres/_ uniquement</p>
              )}
              {form.username.length >= 3 && usernameStatus === 'available' && (
                <p className="text-emerald-400 text-xs mt-1">✓ Disponible</p>
              )}
            </div>

            <div>
              <Label className="text-slate-200 text-xs">Nom complet *</Label>
              <Input value={form.nom_complet} onChange={e => modifier("nom_complet", e.target.value)} placeholder="Jean Dupont" className="bg-white/10 border-white/20 text-white placeholder:text-slate-400 rounded-xl h-11 mt-1" />
            </div>
            <div>
              <Label className="text-slate-200 text-xs">Email * <span className="text-slate-400">(servira d'identifiant)</span></Label>
              <div className="relative">
                <Input type="email" value={form.email} onChange={e => { modifier("email", e.target.value); verifierEmail(e.target.value); }} placeholder="votre@email.com" className="bg-white/10 border-white/20 text-white placeholder:text-slate-400 rounded-xl h-11 mt-1" />
                {form.email && emailVerifie !== null && (
                  <div className={`text-xs mt-1 font-medium ${emailVerifie ? "text-emerald-400" : "text-red-400"}`}>
                    {emailVerifie ? "✓ Email disponible" : "✗ Email déjà utilisé"}
                  </div>
                )}
              </div>
            </div>
            <div>
              <Label className="text-slate-200 text-xs">Téléphone *</Label>
              <Input value={form.telephone} onChange={e => modifier("telephone", e.target.value)} placeholder="+237 6XX XXX XXX" className="bg-white/10 border-white/20 text-white placeholder:text-slate-400 rounded-xl h-11 mt-1" />
            </div>
            <div>
              <Label className="text-slate-200 text-xs">Mot de passe * <span className="text-slate-400">(min. 8 caractères, 1 majuscule, 1 chiffre)</span></Label>
              <div className="relative mt-1">
                <Input type={mdpVisible ? "text" : "password"} value={form.mot_de_passe} onChange={e => modifier("mot_de_passe", e.target.value)} placeholder="••••••••" className="bg-white/10 border-white/20 text-white placeholder:text-slate-400 rounded-xl h-11 pr-12" />
                <button type="button" onClick={() => setMdpVisible(!mdpVisible)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
                  {mdpVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {erreurMdp && <p className="text-red-400 text-xs mt-1">✗ {erreurMdp}</p>}
              {form.mot_de_passe && !erreurMdp && <p className="text-emerald-400 text-xs mt-1">✓ Mot de passe valide</p>}
            </div>
            <div>
              <Label className="text-slate-200 text-xs">Confirmer le mot de passe *</Label>
              <Input type="password" value={form.confirmer_mdp} onChange={e => modifier("confirmer_mdp", e.target.value)} placeholder="••••••••" className="bg-white/10 border-white/20 text-white placeholder:text-slate-400 rounded-xl h-11 mt-1" />
              {form.confirmer_mdp && form.mot_de_passe !== form.confirmer_mdp && (
                <p className="text-red-400 text-xs mt-1">✗ Les mots de passe ne correspondent pas</p>
              )}
            </div>
            <Button onClick={validerEtape1} disabled={enCours} className="w-full h-11 bg-[#F5C518] hover:bg-[#e0b010] text-[#1a1f5e] font-black rounded-xl">
              {enCours ? <Loader2 className="w-4 h-4 animate-spin" /> : "Continuer →"}
            </Button>
          </div>
        )}

        {/* ÉTAPE 2 : Vérification Email */}
        {etape === 2 && (
          <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-6 border border-white/20 space-y-4">
            <h2 className="text-white font-bold">Vérifier votre email</h2>
            <p className="text-slate-300 text-sm">Un code de vérification a été envoyé à <span className="font-semibold">{vendeurEmail}</span></p>
            
            <div>
              <Label className="text-slate-200 text-xs">Code de vérification (6 chiffres) *</Label>
              <Input 
                type="text" 
                maxLength="6"
                placeholder="000000" 
                value={form.verification_code} 
                onChange={e => modifier("verification_code", e.target.value.replace(/[^0-9]/g, ''))} 
                className="bg-white/10 border-white/20 text-white placeholder:text-slate-400 rounded-xl h-11 mt-1 text-center text-2xl tracking-widest font-mono" 
              />
            </div>

            <div className="text-sm text-slate-300">
              <p>Vous n'avez pas reçu le code ?</p>
              <button 
                type="button"
                onClick={renvoyerCode}
                disabled={reenvoyerDisable || enCours}
                className="text-[#F5C518] hover:underline font-semibold disabled:opacity-50"
              >
                {reenvoyerDisable ? "Renvoyer dans 30s..." : "Renvoyer le code"}
              </button>
            </div>

            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => { setEtape(1); setErreur(""); }} 
                className="flex-1 border-white/20 text-white hover:bg-white/10 rounded-xl h-11"
              >
                <ChevronLeft className="w-4 h-4 mr-1" /> Retour
              </Button>
              <Button 
                onClick={validerEtape2} 
                disabled={enCours || form.verification_code.length !== 6}
                className="flex-1 h-11 bg-[#F5C518] hover:bg-[#e0b010] text-[#1a1f5e] font-black rounded-xl"
              >
                {enCours ? <Loader2 className="w-4 h-4 animate-spin" /> : "Vérifier →"}
              </Button>
            </div>
          </div>
        )}

        {/* ÉTAPE 3 : Profil vendeur */}
        {etape === 3 && (
          <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-6 border border-white/20 space-y-4">
            <h2 className="text-white font-bold">Mon profil vendeur</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-slate-200 text-xs">Ville *</Label>
                <Input value={form.ville} onChange={e => modifier("ville", e.target.value)} placeholder="Douala" className="bg-white/10 border-white/20 text-white placeholder:text-slate-400 rounded-xl h-11 mt-1" />
              </div>
              <div>
                <Label className="text-slate-200 text-xs">Quartier *</Label>
                <Input value={form.quartier} onChange={e => modifier("quartier", e.target.value)} placeholder="Akwa" className="bg-white/10 border-white/20 text-white placeholder:text-slate-400 rounded-xl h-11 mt-1" />
              </div>
            </div>
            <div>
              <Label className="text-slate-200 text-xs">Opérateur Mobile Money *</Label>
              <Select value={form.operateur_mobile_money} onValueChange={v => modifier("operateur_mobile_money", v)}>
                <SelectTrigger className="bg-white/10 border-white/20 text-white rounded-xl h-11 mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="orange_money">Orange Money</SelectItem>
                  <SelectItem value="mtn_momo">MTN MoMo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-slate-200 text-xs">Numéro Mobile Money * <span className="text-slate-400">(pour recevoir vos commissions)</span></Label>
              <Input value={form.numero_mobile_money} onChange={e => modifier("numero_mobile_money", e.target.value)} placeholder="+237 6XX XXX XXX" className="bg-white/10 border-white/20 text-white placeholder:text-slate-400 rounded-xl h-11 mt-1" />
            </div>
            <div>
              <Label className="text-slate-200 text-xs">Expérience en vente <span className="text-slate-400">(optionnel)</span></Label>
              <Input value={form.experience_vente} onChange={e => modifier("experience_vente", e.target.value)} placeholder="Ex: vente en ligne, boutique physique..." className="bg-white/10 border-white/20 text-white placeholder:text-slate-400 rounded-xl h-11 mt-1" />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setEtape(2); setErreur(""); }} className="flex-1 border-white/20 text-white hover:bg-white/10 rounded-xl h-11">
                <ChevronLeft className="w-4 h-4 mr-1" /> Retour
              </Button>
              <Button onClick={validerEtape3} disabled={enCours} className="flex-1 h-11 bg-[#F5C518] hover:bg-[#e0b010] text-[#1a1f5e] font-black rounded-xl">
                {enCours ? <Loader2 className="w-4 h-4 animate-spin" /> : "Accéder à mon espace →"}
              </Button>
            </div>
          </div>
        )}

        {/* ÉTAPE 4 : KYC with camera support */}
        {etape === 4 && (
          <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-6 border border-white/20 space-y-4">
            <div>
              <h2 className="text-white font-bold">Vérification d'identité (KYC)</h2>
              <p className="text-slate-300 text-xs mt-0.5">Ces documents permettent à notre équipe de valider votre compte.</p>
            </div>

            <div>
              <Label className="text-slate-200 text-xs mb-2 block">Type de document *</Label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'cni', label: "🪪 Carte Nationale\nd'Identité (CNI)" },
                  { id: 'passeport', label: '📘 Passeport' }
                ].map(type => (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => {
                      setTypeDocument(type.id);
                      setKycDocs({ recto: null, verso: null, selfie: null, passeport: null });
                      setKycPreviews({ recto: null, verso: null, selfie: null, passeport: null });
                    }}
                    className={`py-3 px-2 rounded-xl text-xs font-bold border transition-all whitespace-pre-line text-center ${
                      typeDocument === type.id
                        ? "bg-[#F5C518]/20 text-[#F5C518] border-[#F5C518]"
                        : "bg-white/5 text-slate-300 border-white/20 hover:bg-white/10"
                    }`}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>

            {typeDocument === 'cni' && (
              <>
                <KycDocUpload docKey="recto" label="CNI Recto (face avant)" hint="Photo claire, bien éclairée" preview={kycPreviews.recto} isUploading={kycUploading.recto} doc={kycDocs.recto} onSelect={handleKycFileSelect} onClear={() => { setKycDocs(p=>({...p,recto:null})); setKycPreviews(p=>({...p,recto:null})); }} />
                <KycDocUpload docKey="verso" label="CNI Verso (face arrière)" hint="Assurez-vous que le texte est lisible" preview={kycPreviews.verso} isUploading={kycUploading.verso} doc={kycDocs.verso} onSelect={handleKycFileSelect} onClear={() => { setKycDocs(p=>({...p,verso:null})); setKycPreviews(p=>({...p,verso:null})); }} />
                <KycDocUpload docKey="selfie" label="Selfie avec votre CNI" hint="Tenez la CNI à côté de votre visage" preview={kycPreviews.selfie} isUploading={kycUploading.selfie} doc={kycDocs.selfie} onSelect={handleKycFileSelect} onClear={() => { setKycDocs(p=>({...p,selfie:null})); setKycPreviews(p=>({...p,selfie:null})); }} isSelfie />
              </>
            )}

            {typeDocument === 'passeport' && (
              <>
                <KycDocUpload docKey="passeport" label="Page photo du passeport" hint="Page avec votre photo et informations" preview={kycPreviews.passeport} isUploading={kycUploading.passeport} doc={kycDocs.passeport} onSelect={handleKycFileSelect} onClear={() => { setKycDocs(p=>({...p,passeport:null})); setKycPreviews(p=>({...p,passeport:null})); }} />
                <KycDocUpload docKey="selfie" label="Selfie avec votre passeport" hint="Tenez le passeport à côté de votre visage" preview={kycPreviews.selfie} isUploading={kycUploading.selfie} doc={kycDocs.selfie} onSelect={handleKycFileSelect} onClear={() => { setKycDocs(p=>({...p,selfie:null})); setKycPreviews(p=>({...p,selfie:null})); }} isSelfie />
              </>
            )}

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setEtape(3); setErreur(""); }} className="flex-1 border-white/20 text-white hover:bg-white/10 rounded-xl h-11">
                <ChevronLeft className="w-4 h-4 mr-1" /> Retour
              </Button>
              <button
                onClick={soumettre}
                disabled={!allKycDocsUploaded() || enCours || Object.values(kycUploading).some(v => v)}
                className="flex-1 h-11 rounded-xl text-sm font-black transition-all"
                style={{
                  background: allKycDocsUploaded() ? 'linear-gradient(135deg, #f5a623, #e8940f)' : 'rgba(255,255,255,0.1)',
                  color: allKycDocsUploaded() ? 'white' : 'rgba(255,255,255,0.3)',
                  cursor: allKycDocsUploaded() ? 'pointer' : 'not-allowed',
                }}
              >
                {enCours
                  ? '⏳ Envoi...'
                  : !allKycDocsUploaded()
                    ? `📎 ${getRequiredKycDocs().filter(k => !kycDocs[k]).length} doc(s) manquant(s)`
                    : '✅ Soumettre mon dossier'
                }
              </button>
            </div>
          </div>
        )}

        <p className="text-center text-slate-400 text-xs mt-5">
          Déjà un compte ?{" "}
          <Link to={createPageUrl("Connexion")} className="text-[#F5C518] font-semibold hover:underline">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
}
