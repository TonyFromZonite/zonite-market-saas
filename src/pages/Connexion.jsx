import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff, Facebook, Send } from "lucide-react";
import { createPageUrl } from "@/utils";
import { LOGO_URL as LOGO } from "@/components/constants";

const TikTokIcon = ({ size = 20 }) =>
<svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.77a4.85 4.85 0 01-1.01-.08z" />
  </svg>;

const MODE_VENDEUR = "vendeur";
const MODE_ADMIN = "admin";

export default function Connexion() {
  const [mode, setMode] = useState(MODE_VENDEUR);
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [mdpVisible, setMdpVisible] = useState(false);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState("");
  const [configs, setConfigs] = useState({});

  const [modeMdpOublie, setModeMdpOublie] = useState(false);
  const [emailOublie, setEmailOublie] = useState("");
  const [mdpOublieSucces, setMdpOublieSucces] = useState(false);
  const [chargementOublie, setChargementOublie] = useState(false);

  useEffect(() => {
    const chargerConfigs = async () => {
      try {
        const { data } = await supabase.from("config_app").select("cle, valeur");
        const map = {};
        (data || []).forEach((i) => {
          try {
            const val = typeof i.valeur === "string" ? i.valeur : JSON.stringify(i.valeur);
            map[i.cle] = val.replace(/^"|"$/g, '');
          } catch {
            map[i.cle] = String(i.valeur || '').replace(/^"|"$/g, '');
          }
        });
        setConfigs(map);
      } catch (_) {}
    };
    chargerConfigs();
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !motDePasse) {setErreur("Veuillez remplir tous les champs.");return;}
    setChargement(true);
    setErreur("");

    try {
      let loginEmail = email.trim().toLowerCase();

      if (!loginEmail.includes("@")) {
        const { data: resolvedEmail, error: rpcError } = await supabase
          .rpc("resolve_username_to_email", { _username: loginEmail });

        if (rpcError || !resolvedEmail) {
          setErreur("Nom d'utilisateur introuvable.");
          return;
        }
        loginEmail = resolvedEmail.toLowerCase();
      }

      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: motDePasse
      });

      if (authError) {
        setErreur("Email ou mot de passe incorrect.");
        return;
      }

      const user = authData.user;
      let role = user.user_metadata?.role || "user";

      // Check actual role from user_roles table (promotion updates this, not metadata)
      if (mode === MODE_ADMIN && role !== "admin" && role !== "sous_admin") {
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .maybeSingle();
        if (roleData?.role === "admin" || roleData?.role === "sous_admin") {
          role = roleData.role;
        }
      }

      let seller = null;

      // Try by user_id first
      const { data: sellerByUserId } = await supabase
        .from("sellers")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      seller = sellerByUserId;

      // Fallback: try by email if user_id not linked
      if (!seller) {
        const { data: sellerByEmail } = await supabase
          .from("sellers")
          .select("*")
          .eq("email", loginEmail)
          .maybeSingle();

        if (sellerByEmail) {
          // Fix missing user_id link
          await supabase
            .from("sellers")
            .update({ user_id: user.id })
            .eq("id", sellerByEmail.id);
          seller = { ...sellerByEmail, user_id: user.id };
        }
      }

      // Clear all previous sessions before setting new one
      localStorage.removeItem("admin_session");
      localStorage.removeItem("sous_admin");
      localStorage.removeItem("vendeur_session");

      if (mode === MODE_ADMIN) {
        if (role !== "admin" && role !== "sous_admin") {
          setErreur("Ce compte n'a pas les droits administrateur.");
          return;
        }

        // For sous_admin, load permissions and store in session
        let permissions = [];
        if (role === "sous_admin") {
          // Get sous_admin record
          const { data: saRecord } = await supabase
            .from("sous_admins")
            .select("id, actif, nom_role")
            .eq("user_id", user.id)
            .maybeSingle();

          if (saRecord && !saRecord.actif) {
            setErreur("Votre compte administrateur est suspendu.");
            return;
          }

          if (saRecord) {
            const { data: permsData } = await supabase
              .from("admin_permissions")
              .select("modules_autorises")
              .eq("sous_admin_id", saRecord.id)
              .maybeSingle();
            permissions = permsData?.modules_autorises || [];
          }

          localStorage.setItem("sous_admin", JSON.stringify({
            id: saRecord?.id || seller?.id || user.id,
            user_id: user.id,
            email: user.email,
            role: "sous_admin",
            nom_complet: user.user_metadata?.full_name || seller?.full_name || "",
            permissions,
          }));
        }

        localStorage.setItem("admin_session", JSON.stringify({
          id: seller?.id || user.id,
          user_id: user.id,
          email: user.email,
          role: role,
          nom_complet: user.user_metadata?.full_name || seller?.full_name || "",
          permissions,
        }));
        window.location.href = "/TableauDeBord";
      } else {
        if (!seller) {
          setErreur("Profil vendeur introuvable. Veuillez vous inscrire.");
          return;
        }
        if (seller.seller_status === "pending_verification") {
          window.location.href = createPageUrl("EnAttenteValidation");
          return;
        }
        localStorage.setItem("vendeur_session", JSON.stringify({
          id: seller.id,
          user_id: user.id,
          email: seller.email,
          nom_complet: seller.full_name,
          role: "vendeur",
          seller_status: seller.seller_status,
          statut_kyc: seller.statut_kyc,
          telephone: seller.telephone,
          catalogue_debloque: seller.catalogue_debloque,
          training_completed: seller.training_completed,
          solde_commission: seller.solde_commission
        }));
        window.location.href = "/EspaceVendeur";
      }
    } catch (err) {
      console.error("Login error:", err);
      setErreur("Une erreur est survenue. Réessayez.");
    } finally {
      setChargement(false);
    }
  };

  const mdpOublie = async (e) => {
    e.preventDefault();
    if (!emailOublie?.trim()) {setErreur("Entrez votre email.");return;}
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailOublie.trim())) {
      setErreur("Veuillez entrer un email valide.");return;
    }
    setChargementOublie(true);
    setErreur("");
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(emailOublie.trim().toLowerCase(), {
        redirectTo: `${window.location.origin}/ResetPassword`
      });
      if (error) {
        if (error.message?.includes('rate limit')) {
          setErreur("Trop de tentatives. Attendez quelques minutes.");
        } else {
          setErreur("Erreur lors de l'envoi. Réessayez.");
        }
      } else {
        setMdpOublieSucces(true);
      }
    } catch {setErreur("Erreur lors de l'envoi. Réessayez.");}
    setChargementOublie(false);
  };

  // Safely extract config values, truncate to prevent layout breakage
  const safeStr = (val, maxLen = 200) => {
    const s = String(val || "").trim();
    return s.length > maxLen ? s.slice(0, maxLen) + "…" : s;
  };
  const safeUrl = (val) => {
    const s = String(val || "").trim();
    try { if (s) new URL(s); return s; } catch { return ""; }
  };

  const lienFacebook = safeUrl(configs["lien_facebook"]);
  const lienTiktok = safeUrl(configs["lien_tiktok"]);
  const lienTelegram = safeUrl(configs["lien_telegram"]);
  const messageAccueil = safeStr(configs["message_accueil"] || "Chaque vente est une victoire.\nAllons-y 🚀", 300);
  const nomApp = safeStr(configs["nom_app"] || "ZONITE Vendeurs", 40);
  const hasSocialLinks = lienFacebook || lienTiktok || lienTelegram;

  const changerMode = (m) => {setMode(m);setErreur("");setModeMdpOublie(false);setMdpOublieSucces(false);setEmail("");setMotDePasse("");};

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0d1240] via-[#1a1f5e] to-[#2d34a5] flex flex-col items-center justify-between px-4 sm:px-6 relative overflow-hidden"
    style={{ paddingTop: "max(2.5rem, env(safe-area-inset-top, 0px))", paddingBottom: "max(2rem, env(safe-area-inset-bottom, 0px))" }}>
      <div className="absolute top-0 right-0 w-72 h-72 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
      <div className="absolute bottom-24 left-0 w-56 h-56 bg-[#F5C518]/10 rounded-full translate-y-1/2 -translate-x-1/2 pointer-events-none" />

      <div className="w-full flex flex-col items-center mt-2 mb-4 sm:mt-4 sm:mb-6 relative z-10 px-2">
        <div className="w-16 h-16 md:w-20 md:h-20 rounded-3xl bg-white shadow-2xl flex items-center justify-center mb-2 md:mb-3 overflow-hidden border-4 border-[#F5C518]/40">
          <img alt="Logo" className="w-full h-full object-contain p-0.5" src={LOGO} />
        </div>
        <h1 className="text-xl md:text-2xl font-black text-white tracking-tight text-center leading-tight truncate max-w-full">
          {String(nomApp).split(" ").map((w, i) =>
          i > 0 ? <span key={i} className="text-[#F5C518]"> {w}</span> : w
          )}
        </h1>
        <p className="text-slate-300 text-xs md:text-sm mt-2 md:mt-1.5 text-center max-w-xs leading-relaxed px-3 line-clamp-3 overflow-hidden">
          {messageAccueil}
        </p>
      </div>

      <div className="w-full max-w-sm sm:max-w-md relative z-10 mb-3 sm:mb-5 px-1">
        <div className="bg-white/10 backdrop-blur rounded-2xl p-1 flex border border-white/15">
          <button onClick={() => changerMode(MODE_VENDEUR)}
          className={`flex-1 py-2 md:py-2.5 rounded-xl text-xs md:text-sm font-bold transition-all ${mode === MODE_VENDEUR ? "bg-[#F5C518] text-[#1a1f5e] shadow" : "text-slate-300 hover:text-white"}`}>
            👤 Espace Vendeur
          </button>
          <button onClick={() => changerMode(MODE_ADMIN)}
          className={`flex-1 py-2 md:py-2.5 rounded-xl text-xs md:text-sm font-bold transition-all ${mode === MODE_ADMIN ? "bg-white text-[#1a1f5e] shadow" : "text-slate-300 hover:text-white"}`}>
            🔐 Espace Admin
          </button>
        </div>
      </div>

      <div className="w-full max-w-sm sm:max-w-md relative z-10 flex-1 flex flex-col justify-center px-1">
        <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-4 sm:p-6 border border-white/20 shadow-2xl">
          {!modeMdpOublie &&
          <div>
              <h2 className="text-white font-bold text-lg md:text-xl mb-0.5">
                {mode === MODE_ADMIN ? "Connexion Administrateur" : "Connexion Vendeur"}
              </h2>
              

            
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="text-slate-200 text-xs font-medium block mb-1.5">Email ou nom d'utilisateur</label>
                  <Input type="text" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="votre@email.com ou username" autoComplete="username"
                className="bg-white/10 border-white/20 text-white placeholder:text-slate-400 focus:border-[#F5C518] rounded-xl h-11" />
                </div>
                <div>
                  <label className="text-slate-200 text-xs font-medium block mb-1.5">Mot de passe</label>
                  <div className="relative">
                    <Input type={mdpVisible ? "text" : "password"} value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)} placeholder="••••••••" autoComplete="current-password"
                  className="bg-white/10 border-white/20 text-white placeholder:text-slate-400 focus:border-[#F5C518] rounded-xl h-11 pr-12" />
                    <button type="button" onClick={() => setMdpVisible(!mdpVisible)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors">
                      {mdpVisible ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
                {erreur &&
              <div className="bg-red-500/20 border border-red-400/30 rounded-xl px-4 py-2.5">
                    <p className="text-red-300 text-xs">{erreur}</p>
                  </div>
              }
                <Button type="submit" disabled={chargement}
              className={`w-full h-11 md:h-12 font-black text-sm md:text-base rounded-xl transition-all active:scale-95 ${mode === MODE_ADMIN ? "bg-white hover:bg-slate-100 text-[#1a1f5e]" : "bg-[#F5C518] hover:bg-[#e0b010] text-[#1a1f5e] shadow-lg shadow-[#F5C518]/20"}`}>
                  {chargement ? "Vérification..." : mode === MODE_ADMIN ? "Accéder au panneau admin →" : "Se connecter →"}
                </Button>
              </form>
              {mode === MODE_VENDEUR &&
            <div className="mt-3 md:mt-4 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                  <button onClick={() => {setModeMdpOublie(true);setErreur("");}} className="text-slate-400 text-xs hover:text-[#F5C518] transition-colors underline underline-offset-2 text-center md:text-left">
                    Mot de passe oublié ?
                  </button>
                  <a href={createPageUrl("InscriptionVendeur")} className="text-[#F5C518] text-xs font-semibold hover:underline text-center md:text-right">
                    Créer mon compte →
                  </a>
                </div>
            }
            </div>
          }
          {mode === MODE_VENDEUR && modeMdpOublie &&
          <div>
              <button onClick={() => {setModeMdpOublie(false);setErreur("");setMdpOublieSucces(false);}} className="text-slate-400 text-xs hover:text-white mb-3 flex items-center gap-1">← Retour</button>
              <h2 className="text-white font-bold text-lg md:text-xl mb-0.5">Mot de passe oublié</h2>
              <p className="text-slate-300 text-xs mb-4">Un lien de réinitialisation vous sera envoyé par email.</p>
            {mdpOublieSucces ?
            <div className="bg-emerald-500/20 border border-emerald-400/30 rounded-xl px-4 py-4 text-center">
                  <div className="text-3xl mb-2">📬</div>
                  <p className="text-emerald-300 text-sm font-semibold">Email envoyé !</p>
                  <p className="text-emerald-200 text-xs mt-1">Vérifiez votre boîte mail :</p>
                  <p className="text-white text-sm font-semibold mt-1">{emailOublie}</p>
                  <p className="text-slate-400 text-[10px] mt-2">⚠️ Vérifiez aussi vos spams. Le lien expire dans 1 heure.</p>
                  <button onClick={() => {setModeMdpOublie(false);setMdpOublieSucces(false);setEmailOublie('');}} className="mt-3 text-[#F5C518] text-xs underline">Retour à la connexion</button>
                </div> :

            <form onSubmit={mdpOublie} className="space-y-4">
                  <div>
                    <label className="text-slate-200 text-xs font-medium block mb-1.5">Votre email</label>
                    <Input type="email" value={emailOublie} onChange={(e) => setEmailOublie(e.target.value)} placeholder="votre@email.com"
                className="bg-white/10 border-white/20 text-white placeholder:text-slate-400 focus:border-[#F5C518] rounded-xl h-11" />
                  </div>
                  {erreur && <div className="bg-red-500/20 border border-red-400/30 rounded-xl px-4 py-2.5"><p className="text-red-300 text-xs">{erreur}</p></div>}
                  <Button type="submit" disabled={chargementOublie} className="w-full h-11 md:h-12 bg-white hover:bg-slate-100 text-[#1a1f5e] font-black text-sm md:text-base rounded-xl transition-all active:scale-95">
                    {chargementOublie ? "Envoi en cours..." : "Recevoir un nouveau mot de passe"}
                  </Button>
                </form>
            }
            </div>
          }
        </div>
      </div>

      {hasSocialLinks && (
        <div className="relative z-10 flex flex-col items-center gap-3 md:gap-4 mt-5 md:mt-8 px-3">
          <p className="text-slate-400 text-xs md:text-sm">Suivez-nous sur</p>
          <div className="flex items-center gap-2.5">
            {lienFacebook && (
              <a href={lienFacebook} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 bg-white/10 hover:bg-[#1877F2]/30 border border-white/20 rounded-xl px-3 py-1.5 text-white text-xs font-medium transition-all active:scale-95">
                <Facebook className="w-3.5 h-3.5 text-[#1877F2]" /> Facebook
              </a>
            )}
            {lienTiktok && (
              <a href={lienTiktok} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl px-3 py-1.5 text-white text-xs font-medium transition-all active:scale-95">
                <TikTokIcon size={14} /> TikTok
              </a>
            )}
            {lienTelegram && (
              <a href={lienTelegram} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 bg-white/10 hover:bg-[#0088cc]/30 border border-white/20 rounded-xl px-3 py-1.5 text-white text-xs font-medium transition-all active:scale-95">
                <Send className="w-3.5 h-3.5 text-[#0088cc]" /> Telegram
              </a>
            )}
          </div>
        </div>
      )}
      <p className="relative z-10 text-slate-500 text-[10px] md:text-xs mt-3 mb-2">© {new Date().getFullYear()} ZONITE — Tous droits réservés</p>
    </div>);
}
