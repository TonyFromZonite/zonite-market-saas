import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Eye, EyeOff, ChevronLeft } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { createPageUrl } from "@/utils";
import { LOGO_URL as LOGO } from "@/components/constants";

const calcStrength = (pwd) => {
  let score = 0;
  if (pwd.length >= 6) score++;
  if (pwd.length >= 10) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[A-Z]/.test(pwd)) score++;
  return score;
};

const getStrengthLabel = (s) => {
  if (s === 0) return { label: "", color: "transparent" };
  if (s === 1) return { label: "Faible", color: "#ef4444" };
  if (s === 2) return { label: "Moyen", color: "#f5a623" };
  return { label: "Fort ✓", color: "#22c55e" };
};

export default function InscriptionVendeur() {
  const { toast } = useToast();
  const navigate = useNavigate();

  const urlParams = new URLSearchParams(window.location.search);
  const refFromUrl = urlParams.get("ref") || "";

  const [form, setForm] = useState({
    full_name: "",
    telephone: "",
    password: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [loading, setLoading] = useState(false);
  const [refCode, setRefCode] = useState(refFromUrl);
  const [refValid, setRefValid] = useState(refFromUrl ? null : undefined);
  const [checkingRef, setCheckingRef] = useState(false);

  // Verification step
  const [etape, setEtape] = useState(1); // 1 = form, 2 = verify code
  const [verificationCode, setVerificationCode] = useState("");
  const [generatedEmail, setGeneratedEmail] = useState("");
  const [sellerId, setSellerId] = useState(null);
  const [reenvoyerDisable, setReenvoyerDisable] = useState(false);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    if (refFromUrl) validateRefCode(refFromUrl);
  }, []);

  const validateRefCode = async (code) => {
    if (!code?.trim() || code.length < 4) { setRefValid(undefined); return; }
    setCheckingRef(true);
    try {
      const { data } = await supabase
        .from("sellers")
        .select("id, full_name, email")
        .eq("code_parrainage", code.toUpperCase().trim())
        .maybeSingle();
      setRefValid(data || null);
    } catch { setRefValid(null); }
    finally { setCheckingRef(false); }
  };

  const handleRegister = async () => {
    if (!form.full_name.trim()) {
      toast({ title: "❌ Nom requis", variant: "destructive" }); return;
    }
    if (!form.telephone.trim() || form.telephone.replace(/[^0-9]/g, "").length < 9) {
      toast({ title: "❌ Numéro invalide", description: "Entrez votre numéro complet.", variant: "destructive" }); return;
    }
    if (!form.password || form.password.length < 6) {
      toast({ title: "❌ Mot de passe trop court", description: "Minimum 6 caractères.", variant: "destructive" }); return;
    }

    setLoading(true);
    setErreur("");

    try {
      const phoneClean = form.telephone.replace(/[^0-9]/g, "");
      const email = `${phoneClean}@zonite.org`;

      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password: form.password,
        options: { data: { full_name: form.full_name, telephone: form.telephone } },
      });

      if (authError) {
        if (authError.message.includes("already registered")) {
          toast({ title: "❌ Numéro déjà utilisé", description: "Ce numéro a déjà un compte. Connectez-vous.", variant: "destructive" });
          return;
        }
        throw authError;
      }

      // Sign in immediately for RLS
      await supabase.auth.signInWithPassword({ email, password: form.password });

      // Generate verification code
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      // Create seller record
      const { data: sellerData, error: sellerError } = await supabase
        .from("sellers")
        .insert({
          user_id: authData.user.id,
          full_name: form.full_name.trim(),
          telephone: form.telephone.trim(),
          email,
          seller_status: "pending_verification",
          wizard_completed: false,
          email_verification_code: code,
          email_verification_expires_at: expiresAt,
        })
        .select("id")
        .single();

      if (sellerError) throw sellerError;

      // Insert user role
      await supabase.from("user_roles").insert({ user_id: authData.user.id, role: "vendeur" });

      // Try to send verification (non-blocking)
      try {
        await supabase.functions.invoke("send-verification-email", {
          body: { email, nom: form.full_name, code },
        });
      } catch (e) { console.warn("Verification email send failed:", e); }

      setSellerId(sellerData.id);
      setGeneratedEmail(email);
      setEtape(2);

    } catch (error) {
      setErreur(error.message || "Erreur lors de l'inscription");
    } finally {
      setLoading(false);
    }
  };

  const validerCode = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      setErreur("Veuillez entrer un code à 6 chiffres"); return;
    }
    setLoading(true);
    setErreur("");

    try {
      const { data: seller, error } = await supabase
        .from("sellers")
        .select("id, email_verification_code, email_verification_expires_at")
        .eq("id", sellerId)
        .single();

      if (error || !seller) { setErreur("Compte introuvable"); return; }
      if (seller.email_verification_code !== verificationCode) { setErreur("Code invalide"); return; }
      if (seller.email_verification_expires_at && new Date(seller.email_verification_expires_at) < new Date()) {
        setErreur("Code expiré. Demandez un nouveau code."); return;
      }

      // Activate immediately
      const updateData = {
        email_verified: true,
        email_verification_code: null,
        seller_status: "active_seller",
      };

      // Save referral
      if (refCode && refValid) {
        updateData.parraine_par = refCode.toUpperCase().trim();
      }

      await supabase.from("sellers").update(updateData).eq("id", seller.id);

      // Create parrainages record
      if (refCode && refValid) {
        try {
          await supabase.from("parrainages").insert({
            parrain_id: refValid.id,
            filleul_id: seller.id,
            code_parrainage: refCode.toUpperCase().trim(),
            actif: true,
            livraisons_comptees: 0,
            commission_totale: 0,
          });
          await supabase.from("notifications_vendeur").insert({
            vendeur_id: refValid.id,
            vendeur_email: refValid.email || "",
            titre: "🎉 Nouveau filleul !",
            message: `${form.full_name} vient de s'inscrire avec votre code ${refCode} !`,
            type: "succes",
          });
        } catch (e) { console.warn("Parrainage failed:", e); }
      }

      // Set session & go to EspaceVendeur (wizard will show)
      localStorage.removeItem("admin_session");
      localStorage.removeItem("sous_admin");
      localStorage.setItem("vendeur_session", JSON.stringify({
        id: seller.id,
        email: generatedEmail,
        nom_complet: form.full_name,
        role: "vendeur",
        seller_status: "active_seller",
        wizard_completed: false,
        catalogue_debloque: false,
        training_completed: false,
      }));
      window.location.href = "/EspaceVendeur";

    } catch (error) {
      setErreur(error.message || "Erreur lors de la vérification");
    } finally {
      setLoading(false);
    }
  };

  const renvoyerCode = async () => {
    setReenvoyerDisable(true);
    try {
      const newCode = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      await supabase.from("sellers").update({
        email_verification_code: newCode,
        email_verification_expires_at: expiresAt,
      }).eq("id", sellerId);
      try {
        await supabase.functions.invoke("send-verification-email", {
          body: { email: generatedEmail, nom: form.full_name, code: newCode },
        });
      } catch {}
      toast({ title: "📨 Code renvoyé !" });
      setTimeout(() => setReenvoyerDisable(false), 30000);
    } catch {
      setErreur("Erreur lors de l'envoi du code");
      setReenvoyerDisable(false);
    }
  };

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
          <h1 className="text-2xl font-black text-white">Créer mon compte</h1>
          <p className="text-slate-300 text-sm mt-1">Rejoignez ZONITE Market gratuitement</p>
        </div>

        {erreur && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-400/30 rounded-xl text-sm text-red-300">{erreur}</div>
        )}

        {/* STEP 1: Registration form */}
        {etape === 1 && (
          <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-6 border border-white/20 space-y-4">

            {/* Field 1: Full name */}
            <div>
              <Label className="text-slate-200 text-xs">Prénom et Nom *</Label>
              <Input
                value={form.full_name}
                onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))}
                placeholder="Ex: Marie Nguemo"
                autoFocus
                className="bg-white/10 border-white/20 text-white placeholder:text-slate-400 rounded-xl h-11 mt-1"
              />
            </div>

            {/* Field 2: Phone */}
            <div>
              <Label className="text-slate-200 text-xs">Numéro de téléphone *</Label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 text-sm font-medium">🇨🇲 +237</span>
                <Input
                  type="tel"
                  value={form.telephone}
                  onChange={e => setForm(p => ({ ...p, telephone: e.target.value }))}
                  placeholder="6XXXXXXXX"
                  className="bg-white/10 border-white/20 text-white placeholder:text-slate-400 rounded-xl h-11 pl-20"
                />
              </div>
            </div>

            {/* Field 3: Password (NO confirmation) */}
            <div>
              <Label className="text-slate-200 text-xs">Mot de passe *</Label>
              <div className="relative mt-1">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={e => {
                    setForm(p => ({ ...p, password: e.target.value }));
                    setPasswordStrength(calcStrength(e.target.value));
                  }}
                  placeholder="Minimum 6 caractères"
                  className="bg-white/10 border-white/20 text-white placeholder:text-slate-400 rounded-xl h-11 pr-12"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-lg">
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {form.password.length > 0 && (
                <div className="mt-2">
                  <div className="flex gap-1 mb-1">
                    {[1, 2, 3, 4].map(i => (
                      <div key={i} className="flex-1 h-1 rounded-full transition-all"
                        style={{ background: i <= passwordStrength ? getStrengthLabel(passwordStrength).color : "rgba(255,255,255,0.1)" }} />
                    ))}
                  </div>
                  <p className="text-xs font-medium" style={{ color: getStrengthLabel(passwordStrength).color }}>
                    {getStrengthLabel(passwordStrength).label}
                  </p>
                </div>
              )}
            </div>

            {/* Referral code */}
            {refCode && (
              <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                <span className="text-lg">🤝</span>
                <div className="flex-1 text-xs text-slate-200">
                  Code parrainage : <span className="text-[#F5C518] font-bold">{refCode}</span>
                  {refValid && <span className="text-emerald-400 ml-1">— {refValid.full_name}</span>}
                </div>
              </div>
            )}

            <Button onClick={handleRegister} disabled={loading}
              className="w-full h-12 bg-[#F5C518] hover:bg-[#e0b010] text-[#1a1f5e] font-black rounded-xl text-base">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "🚀 Créer mon compte gratuit"}
            </Button>

            <p className="text-center text-slate-400 text-xs">
              Déjà un compte ?{" "}
              <span onClick={() => navigate("/Connexion")} className="text-[#F5C518] cursor-pointer font-semibold hover:underline">
                Se connecter
              </span>
            </p>
          </div>
        )}

        {/* STEP 2: Verification code */}
        {etape === 2 && (
          <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-6 border border-white/20 space-y-4">
            <h2 className="text-white font-bold">Vérifier votre numéro</h2>
            <p className="text-slate-300 text-sm">Un code de vérification a été envoyé. Entrez-le ci-dessous.</p>

            <div>
              <Label className="text-slate-200 text-xs">Code de vérification (6 chiffres) *</Label>
              <Input
                type="text"
                maxLength="6"
                placeholder="000000"
                value={verificationCode}
                onChange={e => setVerificationCode(e.target.value.replace(/[^0-9]/g, ""))}
                className="bg-white/10 border-white/20 text-white placeholder:text-slate-400 rounded-xl h-11 mt-1 text-center text-2xl tracking-widest font-mono"
              />
            </div>

            <div className="text-sm text-slate-300">
              <p>Vous n'avez pas reçu le code ?</p>
              <button type="button" onClick={renvoyerCode} disabled={reenvoyerDisable || loading}
                className="text-[#F5C518] hover:underline font-semibold disabled:opacity-50">
                {reenvoyerDisable ? "Renvoyer dans 30s..." : "Renvoyer le code"}
              </button>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setEtape(1); setErreur(""); }}
                className="flex-1 border-white/20 text-white hover:bg-white/10 rounded-xl h-11">
                <ChevronLeft className="w-4 h-4 mr-1" /> Retour
              </Button>
              <Button onClick={validerCode} disabled={loading || verificationCode.length !== 6}
                className="flex-1 h-11 bg-[#F5C518] hover:bg-[#e0b010] text-[#1a1f5e] font-black rounded-xl">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Vérifier →"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
