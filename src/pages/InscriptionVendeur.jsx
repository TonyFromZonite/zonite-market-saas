import React, { useState, useEffect, useRef } from "react";
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
  if (s >= 3) return { label: "Fort ✓", color: "#22c55e" };
};

/**
 * Extrait proprement le payload d'erreur d'un appel `supabase.functions.invoke`.
 * Évite l'affichage du message générique "Edge Function returned a non-2xx status code".
 */
async function extractFunctionError(error, fallback = "Une erreur est survenue. Réessayez dans un instant.") {
  const ctx = error?.context;
  const status = ctx?.status;
  let payload = null;
  let rawText = "";
  try {
    if (ctx && typeof ctx.clone === "function") {
      try { payload = await ctx.clone().json(); }
      catch (_) {
        try {
          rawText = await ctx.clone().text();
          if (rawText) { try { payload = JSON.parse(rawText); } catch (_) {} }
        } catch (_) {}
      }
    }
  } catch (_) {}
  const isGeneric = !error?.message || /non-2xx/i.test(error.message);
  const message =
    payload?.error ||
    (rawText && !rawText.startsWith("{") ? rawText : null) ||
    (isGeneric ? fallback : error?.message) ||
    fallback;
  if (typeof console !== "undefined") {
    console.error("[edge-fn error]", { status, payload, rawText, message });
  }
  return { message, status, payload: payload || {} };
}

export default function InscriptionVendeur() {
  const { toast } = useToast();
  const navigate = useNavigate();

  const urlParams = new URLSearchParams(window.location.search);
  const refFromUrl = urlParams.get("ref") || "";

  const [form, setForm] = useState({
    full_name: "",
    username: "",
    email: "",
    password: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [loading, setLoading] = useState(false);
  const [refCode] = useState(refFromUrl);
  const [refValid, setRefValid] = useState(refFromUrl ? null : undefined);
  const [manualRef, setManualRef] = useState("");
  const [manualRefValid, setManualRefValid] = useState(undefined);
  const [errors, setErrors] = useState({});
  const [checking, setChecking] = useState({});
  const manualRefTimer = useRef(null);

  // Verification step
  const [etape, setEtape] = useState(1);
  const [verificationCode, setVerificationCode] = useState("");
  const [sellerId, setSellerId] = useState(null);
  const [reenvoyerDisable, setReenvoyerDisable] = useState(false);
  const [erreur, setErreur] = useState("");

  const usernameTimer = useRef(null);
  const emailTimer = useRef(null);

  useEffect(() => {
    if (refFromUrl) validateRefCode(refFromUrl);

    // Resume verification flow when redirected from login (email not verified)
    const verifyMode = urlParams.get("verify");
    const sellerIdParam = urlParams.get("seller_id");
    if (verifyMode === "1" && sellerIdParam) {
      (async () => {
        const { data } = await supabase
          .from("sellers")
          .select("id, email, full_name")
          .eq("id", sellerIdParam)
          .maybeSingle();
        if (data) {
          setSellerId(data.id);
          setForm((f) => ({ ...f, email: data.email || "", full_name: data.full_name || "" }));
          setEtape(2);
          setErreur("Votre email n'est pas encore vérifié. Un nouveau code vient d'être envoyé.");
        }
      })();
    }
  }, []);

  const validateRefCode = async (code) => {
    if (!code?.trim() || code.length < 3) { setRefValid(undefined); return; }
    try {
      const { data } = await supabase.rpc("validate_referral_code", { _code: code });
      const match = data?.[0] || null;
      setRefValid(match);
    } catch { setRefValid(null); }
  };

  const validateManualRef = (code) => {
    clearTimeout(manualRefTimer.current);
    setManualRefValid(undefined);
    manualRefTimer.current = setTimeout(async () => {
      try {
        const { data } = await supabase.rpc("validate_referral_code", { _code: code });
        const match = data?.[0] || null;
        setManualRefValid(match);
      } catch { setManualRefValid(null); }
    }, 500);
  };

  // Real-time username check
  const checkUsername = (val) => {
    clearTimeout(usernameTimer.current);
    if (!val || val.length < 3) {
      setErrors(p => ({ ...p, username: val ? "Minimum 3 caractères" : null }));
      return;
    }
    setChecking(p => ({ ...p, username: true }));
    usernameTimer.current = setTimeout(async () => {
      const { data } = await supabase
        .from("sellers")
        .select("id")
        .eq("username", val.toLowerCase())
        .maybeSingle();
      setErrors(p => ({ ...p, username: data ? "Ce nom est déjà pris" : null }));
      setChecking(p => ({ ...p, username: false }));
    }, 500);
  };

  // Real-time email check
  const checkEmail = (val) => {
    clearTimeout(emailTimer.current);
    if (!val || !val.includes("@")) {
      setErrors(p => ({ ...p, email: null }));
      return;
    }
    setChecking(p => ({ ...p, email: true }));
    emailTimer.current = setTimeout(async () => {
      const { data } = await supabase
        .from("sellers")
        .select("id")
        .eq("email", val.toLowerCase().trim())
        .maybeSingle();
      setErrors(p => ({ ...p, email: data ? "Cet email a déjà un compte" : null }));
      setChecking(p => ({ ...p, email: false }));
    }, 500);
  };

  const handleRegister = async () => {
    const newErrors = {};
    if (!form.full_name.trim()) newErrors.full_name = "Nom requis";
    if (!form.username?.trim() || form.username.length < 3) newErrors.username = "Minimum 3 caractères";
    if (errors.username) newErrors.username = errors.username;
    if (!form.email.trim() || !form.email.includes("@")) newErrors.email = "Email invalide";
    if (errors.email) newErrors.email = errors.email;
    if (!form.password || form.password.length < 6) newErrors.password = "Minimum 6 caractères";

    if (Object.values(newErrors).some(Boolean)) {
      setErrors(p => ({ ...p, ...newErrors }));
      return;
    }

    setLoading(true);
    setErreur("");

    try {
      const emailClean = form.email.toLowerCase().trim();
      const usernameClean = form.username.toLowerCase().trim().replace(/[^a-z0-9_]/g, "");
      const effectiveRefCode = refCode
        ? refCode.toUpperCase().trim()
        : (manualRef && manualRefValid ? manualRef.toUpperCase().trim() : null);

      // Atomic server-side registration : auth.users + sellers + user_roles + OTP
      const { data, error } = await supabase.functions.invoke("register-seller", {
        body: {
          full_name: form.full_name.trim(),
          username: usernameClean,
          email: emailClean,
          password: form.password,
          parraine_par: effectiveRefCode,
        },
      });

      // Edge function HTTP error (non-2xx) → `error` is set, body in error.context
      if (error) {
        const { message, payload } = await extractFunctionError(
          error,
          "Une erreur est survenue lors de l'inscription. Réessayez dans un instant."
        );
        if (payload?.throttled || payload?.retry_after > 0) {
          const retry = payload.retry_after || 60;
          setCooldownLeft(retry);
          setErreur(message);
          toast({
            title: "⏳ Patientez",
            description: message,
            variant: "destructive",
          });
          return;
        }
        if (payload?.field) {
          setErrors((p) => ({ ...p, [payload.field]: message }));
        } else {
          setErreur(message);
        }
        return;
      }
      if (data?.error) {
        if (data.throttled || data.retry_after > 0) {
          const retry = data.retry_after || 60;
          setCooldownLeft(retry);
          setErreur(data.error);
          toast({ title: "⏳ Patientez", description: data.error, variant: "destructive" });
          return;
        }
        if (data.field) setErrors((p) => ({ ...p, [data.field]: data.error }));
        else setErreur(data.error);
        return;
      }


      if (data?.resumed) {
        setErreur("Un nouveau code de vérification vient d'être envoyé à votre email.");
      }

      // Sign in client-side so RLS allows reading/updating own seller row in step 2
      try {
        await supabase.auth.signInWithPassword({ email: emailClean, password: form.password });
      } catch (e) { console.warn("Auto sign-in after register failed:", e); }

      setSellerId(data.seller_id);
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
        .select("id, email_verification_code, email_verification_expires_at, email")
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

      await supabase.from("sellers").update(updateData).eq("id", seller.id);

      // Create parrainages record if referral
      const finalRefCode = refCode ? refCode.toUpperCase().trim() : (manualRef ? manualRef.toUpperCase().trim() : null);
      const finalRefData = refCode ? refValid : manualRefValid;
      if (finalRefCode && finalRefData) {
        try {
          await supabase.from("parrainages").insert({
            parrain_id: finalRefData.id,
            filleul_id: seller.id,
            code_parrainage: finalRefCode,
            actif: true,
            livraisons_comptees: 0,
            commission_totale: 0,
          });
          await supabase.from("notifications_vendeur").insert({
            vendeur_id: finalRefData.id,
            vendeur_email: finalRefData.email || "",
            titre: "🎉 Nouveau filleul !",
            message: `${form.full_name} vient de s'inscrire avec votre code ${finalRefCode} !`,
            type: "succes",
          });
        } catch (e) { console.warn("Parrainage failed:", e); }
      }

      // Set session & go to EspaceVendeur
      localStorage.removeItem("admin_session");
      localStorage.removeItem("sous_admin");
      localStorage.setItem("vendeur_session", JSON.stringify({
        id: seller.id,
        email: seller.email,
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

  const [cooldownLeft, setCooldownLeft] = useState(0);

  useEffect(() => {
    if (cooldownLeft <= 0) return;
    const t = setInterval(() => setCooldownLeft((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [cooldownLeft]);

  const renvoyerCode = async () => {
    if (reenvoyerDisable || cooldownLeft > 0) return;
    setReenvoyerDisable(true);
    try {
      const { data, error } = await supabase.functions.invoke("resend-verification-code", {
        body: { seller_id: sellerId, email: form.email.toLowerCase().trim() },
      });
      if (error || data?.error) {
        const retry = data?.retry_after || 0;
        if (retry > 0) setCooldownLeft(retry);
        setErreur(data?.error || error?.message || "Erreur lors de l'envoi du code");
        toast({ title: "⏳ Trop de tentatives", description: data?.error || "Patientez avant de réessayer", variant: "destructive" });
        return;
      }
      const cd = data?.cooldown_seconds || 60;
      setCooldownLeft(cd);
      toast({
        title: "📨 Code renvoyé !",
        description: `Tentatives : ${data?.attempts_used}/${data?.attempts_max}`,
      });
    } catch (e) {
      setErreur("Erreur lors de l'envoi du code");
    } finally {
      setReenvoyerDisable(false);
    }
  };


  const usernameOk = form.username?.length >= 3 && !errors.username && !checking.username;
  const emailOk = form.email.includes("@") && !errors.email && !checking.email;

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

            {/* Referral badge */}
            {refCode && refValid && (
              <div className="flex items-center gap-3 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                <span className="text-lg">🤝</span>
                <div className="flex-1">
                  <p className="text-emerald-400 text-xs font-semibold">Invité par {refValid.full_name}</p>
                  <p className="text-slate-400 text-[10px]">Code : {refCode.toUpperCase()}</p>
                </div>
              </div>
            )}

            {/* Field 1: Full name */}
            <div>
              <Label className="text-slate-200 text-xs">Prénom et Nom *</Label>
              <Input
                value={form.full_name}
                onChange={e => {
                  setForm(p => ({ ...p, full_name: e.target.value }));
                  setErrors(p => ({ ...p, full_name: null }));
                }}
                placeholder="Ex: Marie Nguemo"
                autoFocus
                className={`bg-white/10 border-white/20 text-white placeholder:text-slate-400 rounded-xl h-11 mt-1 ${errors.full_name ? "border-red-400/50" : ""}`}
              />
              {errors.full_name && <p className="text-red-400 text-[11px] mt-1">⚠️ {errors.full_name}</p>}
            </div>

            {/* Field 2: Username */}
            <div>
              <Label className="text-slate-200 text-xs">Nom d'utilisateur *</Label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">@</span>
                <Input
                  value={form.username}
                  onChange={e => {
                    const val = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "");
                    setForm(p => ({ ...p, username: val }));
                    checkUsername(val);
                  }}
                  placeholder="marie237"
                  maxLength={20}
                  className={`bg-white/10 text-white placeholder:text-slate-400 rounded-xl h-11 pl-8 pr-10 ${errors.username ? "border-red-400/50" : usernameOk ? "border-emerald-400/50" : "border-white/20"}`}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm">
                  {checking.username ? "⏳" : usernameOk ? "✅" : ""}
                </span>
              </div>
              <p className={`text-[10px] mt-1 ${errors.username ? "text-red-400" : "text-slate-400"}`}>
                {errors.username ? `❌ ${errors.username}` : "Lettres, chiffres et _ uniquement"}
              </p>
            </div>

            {/* Field 3: Email */}
            <div>
              <Label className="text-slate-200 text-xs">Adresse email *</Label>
              <div className="relative mt-1">
                <Input
                  type="email"
                  value={form.email}
                  onChange={e => {
                    setForm(p => ({ ...p, email: e.target.value }));
                    setErrors(p => ({ ...p, email: null }));
                    checkEmail(e.target.value);
                  }}
                  placeholder="votre@email.com"
                  className={`bg-white/10 text-white placeholder:text-slate-400 rounded-xl h-11 pr-10 ${errors.email ? "border-red-400/50" : emailOk ? "border-emerald-400/50" : "border-white/20"}`}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm">
                  {checking.email ? "⏳" : emailOk ? "✅" : ""}
                </span>
              </div>
              <p className={`text-[10px] mt-1 ${errors.email ? "text-red-400" : "text-slate-400"}`}>
                {errors.email ? `❌ ${errors.email}` : "📧 Le code de vérification sera envoyé à cet email"}
              </p>
            </div>

            {/* Field 4: Password */}
            <div>
              <Label className="text-slate-200 text-xs">Mot de passe *</Label>
              <div className="relative mt-1">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={e => {
                    setForm(p => ({ ...p, password: e.target.value }));
                    setPasswordStrength(calcStrength(e.target.value));
                    setErrors(p => ({ ...p, password: null }));
                  }}
                  placeholder="Minimum 6 caractères"
                  className={`bg-white/10 border-white/20 text-white placeholder:text-slate-400 rounded-xl h-11 pr-12 ${errors.password ? "border-red-400/50" : ""}`}
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
              {errors.password && <p className="text-red-400 text-[11px] mt-1">⚠️ {errors.password}</p>}
            </div>

            {/* Field 5: Referral code (optional) */}
            {!refCode && (
              <div>
                <Label className="text-slate-200 text-xs">Code de parrainage <span className="text-slate-400">(optionnel)</span></Label>
                <div className="relative mt-1">
                  <Input
                    value={manualRef}
                    onChange={e => {
                      const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
                      setManualRef(val);
                      if (val.length >= 3) validateManualRef(val);
                      else setManualRefValid(undefined);
                    }}
                    placeholder="Ex: MARIE237"
                    maxLength={12}
                    className={`bg-white/10 text-white placeholder:text-slate-400 rounded-xl h-11 pr-10 ${manualRefValid === null ? "border-red-400/50" : manualRefValid ? "border-emerald-400/50" : "border-white/20"}`}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm">
                    {manualRef.length >= 3 && manualRefValid === undefined ? "⏳" : manualRefValid ? "✅" : manualRefValid === null ? "❌" : ""}
                  </span>
                </div>
                {manualRefValid && (
                  <p className="text-emerald-400 text-[10px] mt-1">🤝 Invité par {manualRefValid.full_name}</p>
                )}
                {manualRefValid === null && manualRef.length >= 3 && (
                  <p className="text-red-400 text-[10px] mt-1">❌ Code invalide</p>
                )}
              </div>
            )}

            <Button onClick={handleRegister} disabled={loading || cooldownLeft > 0}
              className="w-full h-12 bg-[#F5C518] hover:bg-[#e0b010] text-[#1a1f5e] font-black rounded-xl text-base disabled:opacity-60">
              {loading
                ? <Loader2 className="w-5 h-5 animate-spin" />
                : cooldownLeft > 0
                  ? `Réessayer dans ${cooldownLeft}s`
                  : "🚀 Créer mon compte gratuit"}
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
            <div className="text-center">
              <div className="text-4xl mb-2">📧</div>
              <h2 className="text-white font-bold text-lg">Vérifiez votre email</h2>
              <p className="text-slate-300 text-sm mt-1">
                Un code à 6 chiffres a été envoyé à<br />
                <span className="text-[#F5C518] font-semibold">{form.email}</span>
              </p>
            </div>

            <div>
              <Label className="text-slate-200 text-xs">Code de vérification *</Label>
              <Input
                type="text"
                maxLength="6"
                placeholder="000000"
                value={verificationCode}
                onChange={e => setVerificationCode(e.target.value.replace(/[^0-9]/g, ""))}
                className="bg-white/10 border-white/20 text-white placeholder:text-slate-400 rounded-xl h-14 mt-1 text-center text-2xl tracking-[0.5em] font-mono"
              />
            </div>

            <div className="text-sm text-slate-300 text-center">
              <p>Pas reçu le code ?</p>
              <button type="button" onClick={renvoyerCode} disabled={reenvoyerDisable || loading || cooldownLeft > 0}
                className="text-[#F5C518] hover:underline font-semibold disabled:opacity-50">
                {cooldownLeft > 0 ? `Renvoyer dans ${cooldownLeft}s...` : (reenvoyerDisable ? "Envoi..." : "Renvoyer le code")}
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
