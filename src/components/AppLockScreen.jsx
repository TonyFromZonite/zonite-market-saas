import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Fingerprint, Lock, Eye, EyeOff } from "lucide-react";

const BIOMETRIC_ERRORS = [
  "No credentials", "no credentials", "NotAllowedError",
  "InvalidStateError", "SecurityError", "no matching", "not registered"
];

const isBioKeyLost = (error) => {
  const msg = (error?.message || error?.name || "").toLowerCase();
  return BIOMETRIC_ERRORS.some(e => msg.includes(e.toLowerCase()));
};

export default function AppLockScreen({ onUnlock }) {
  const [mode, setMode] = useState("bio"); // bio | password
  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioLoading, setBioLoading] = useState(false);
  const [bioError, setBioError] = useState("");

  const [password, setPassword] = useState("");
  const [passLoading, setPassLoading] = useState(false);
  const [passError, setPassError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Determine role: check admin_session FIRST, then vendeur_session
  const adminSession = JSON.parse(localStorage.getItem("admin_session") || "{}");
  const vendorSession = JSON.parse(localStorage.getItem("vendeur_session") || "{}");

  const isAdmin = !!(adminSession?.email && (adminSession?.role === "admin" || adminSession?.role === "sous_admin"));
  const currentSession = isAdmin ? adminSession : vendorSession;

  const userName = currentSession?.full_name || currentSession?.nom_complet || currentSession?.email || "Utilisateur";
  const userEmail = currentSession?.email || "";
  const initials = userName.split(" ").map(n => (n[0] || "")).join("").slice(0, 2).toUpperCase();

  useEffect(() => {
    checkBioAvailable();
  }, []);

  useEffect(() => {
    if (bioAvailable && mode === "bio") {
      const t = setTimeout(() => triggerBiometric(), 800);
      return () => clearTimeout(t);
    }
  }, [bioAvailable]);

  const checkBioAvailable = async () => {
    try {
      const available = window.PublicKeyCredential
        && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      setBioAvailable(!!available);
      if (!available) setMode("password");
    } catch {
      setBioAvailable(false);
      setMode("password");
    }
  };

  const triggerBiometric = async () => {
    setBioLoading(true);
    setBioError("");
    try {
      const result = await navigator.credentials.get({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          rpId: window.location.hostname,
          userVerification: "required",
          timeout: 60000,
          allowCredentials: [],
        },
      });
      if (result) {
        handleUnlockSuccess();
      }
    } catch (err) {
      setBioLoading(false);
      if (isBioKeyLost(err)) {
        setBioError("Clé biométrique non disponible. Entrez votre mot de passe.");
        localStorage.removeItem("bio_enabled");
        setTimeout(() => { setMode("password"); setBioError(""); }, 1500);
      } else if (err.name === "NotAllowedError") {
        setBioError("Vérification annulée. Réessayez.");
      } else {
        setBioError("Erreur biométrique. Utilisez votre mot de passe.");
        setTimeout(() => { setMode("password"); setBioError(""); }, 2000);
      }
    } finally {
      setBioLoading(false);
    }
  };

  const handlePasswordUnlock = async () => {
    if (!password.trim()) { setPassError("Entrez votre mot de passe"); return; }
    if (!userEmail) { setPassError("Aucun email trouvé dans la session."); return; }

    setPassLoading(true);
    setPassError("");
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password: password.trim(),
      });
      if (error) throw error;

      if (data.user) {
        await refreshSession(data.user, isAdmin);

        // Offer to re-enable biometric if it was lost
        if (bioAvailable && localStorage.getItem("bio_enabled") !== "true") {
          const reEnable = window.confirm("Réactiver la connexion biométrique (empreinte/Face ID) ?");
          if (reEnable) {
            localStorage.setItem("bio_enabled", "true");
          }
        }

        handleUnlockSuccess();
      }
    } catch {
      setPassError("Mot de passe incorrect. Réessayez.");
      setPassword("");
    } finally {
      setPassLoading(false);
    }
  };

  const refreshSession = async (authUser, admin) => {
    if (admin) {
      const adminData = localStorage.getItem("admin_session");
      if (adminData) {
        const parsed = JSON.parse(adminData);
        localStorage.setItem("admin_session", JSON.stringify({
          ...parsed,
          last_unlocked: new Date().toISOString(),
        }));
      }
    } else {
      try {
        const { data: seller } = await supabase
          .from("sellers")
          .select("*")
          .eq("user_id", authUser.id)
          .single();
        if (seller) {
          localStorage.setItem("vendeur_session", JSON.stringify({
            id: seller.id,
            user_id: authUser.id,
            email: seller.email,
            full_name: seller.full_name,
            nom_complet: seller.full_name,
            seller_status: seller.seller_status,
            role: seller.role || "user",
            catalogue_debloque: seller.catalogue_debloque,
            training_completed: seller.training_completed,
            solde_commission: seller.solde_commission || 0,
          }));
        }
      } catch {}
    }
  };

  const handleUnlockSuccess = () => {
    localStorage.setItem("bio_enabled", localStorage.getItem("bio_enabled") || "true");
    onUnlock(isAdmin ? "/TableauDeBord" : "/EspaceVendeur");
  };

  const handleFullLogout = async () => {
    if (!window.confirm("Voulez-vous vous déconnecter complètement ?")) return;
    try { await supabase.auth.signOut(); } catch {}
    localStorage.removeItem("vendeur_session");
    localStorage.removeItem("admin_session");
    localStorage.removeItem("sous_admin");
    localStorage.removeItem("bio_enabled");
    localStorage.removeItem("last_notif_check");
    window.location.href = "/Connexion";
  };

  return (
    <div className="fixed inset-0 z-[10000] flex flex-col items-center justify-between bg-gradient-to-b from-[#0a1037] to-[#1a1f4e] py-12 px-6">
      {/* Top time */}
      <div className="text-center">
        <p className="text-5xl font-light text-white tracking-tight">
          {new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
        </p>
        <p className="text-sm text-white/50 mt-1 capitalize">
          {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
        </p>
      </div>

      {/* Center */}
      <div className="flex flex-col items-center gap-5 w-full max-w-[300px]">
        <div className="w-20 h-20 rounded-full bg-white/10 ring-4 ring-white/20 flex items-center justify-center text-2xl font-bold text-[#F5C518]">
          {initials || "👤"}
        </div>
        <div className="text-center">
          <p className="text-lg font-semibold text-white">{userName}</p>
          <p className="text-xs text-white/40">
            {isAdmin ? "👑 Administrateur" : "🏪 Vendeur"} · Zonite Market
          </p>
        </div>

        {/* BIO MODE */}
        {mode === "bio" && (
          <div className="flex flex-col items-center gap-3">
            <button
              onClick={triggerBiometric}
              disabled={bioLoading}
              className="w-16 h-16 rounded-full bg-[#F5C518]/20 flex items-center justify-center transition-all hover:bg-[#F5C518]/30 disabled:opacity-50"
              style={bioLoading ? { animation: "pulse 1.5s infinite" } : {}}
            >
              <Fingerprint className="w-8 h-8 text-[#F5C518]" />
            </button>
            <p className="text-xs text-white/40">
              {bioLoading ? "Vérification…" : "Toucher pour déverrouiller"}
            </p>
            <p className="text-[10px] text-white/25">Empreinte digitale · Face ID</p>

            {bioError && (
              <p className="text-xs text-red-400 bg-red-500/10 px-3 py-1.5 rounded-lg text-center">{bioError}</p>
            )}

            <button
              onClick={() => { setMode("password"); setBioError(""); }}
              className="bg-white/[0.08] border border-white/15 rounded-lg px-5 py-2.5 text-white/60 text-[13px] hover:bg-white/15 transition-colors mt-1"
            >
              🔑 Utiliser mon mot de passe
            </button>
          </div>
        )}

        {/* PASSWORD MODE */}
        {mode === "password" && (
          <div className="flex flex-col items-center gap-3 w-full">
            <p className="text-xs text-white/50 text-center">
              Entrez votre mot de passe pour déverrouiller
            </p>
            <p className="text-[11px] text-white/30 bg-white/[0.06] px-3 py-1 rounded-full">
              {userEmail}
            </p>

            <div className="relative w-full">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => { setPassword(e.target.value); setPassError(""); }}
                onKeyDown={(e) => e.key === "Enter" && handlePasswordUnlock()}
                placeholder="Mot de passe"
                autoFocus
                className="w-full rounded-xl bg-white/10 px-4 py-3.5 pr-12 text-white placeholder:text-white/30 border border-white/20 focus:border-[#F5C518] focus:outline-none text-base"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white/80"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>

            {passError && (
              <div className="flex flex-col items-center gap-2">
                <p className="text-xs text-red-400 bg-red-500/10 px-3 py-1.5 rounded-lg">❌ {passError}</p>
                <button
                  onClick={() => { window.location.href = "/MotDePasseOublie"; }}
                  className="text-[11px] text-[#F5C518]/70 hover:text-[#F5C518] underline underline-offset-2 transition-colors"
                >
                  Mot de passe oublié ?
                </button>
              </div>
            )}

            <button
              onClick={handlePasswordUnlock}
              disabled={passLoading || !password.trim()}
              className="w-full rounded-xl bg-[#F5C518] py-3 text-[#1a1f5e] font-bold text-sm hover:bg-[#e0b010] transition-colors disabled:opacity-40"
            >
              {passLoading ? "⏳ Vérification..." : "🔓 Déverrouiller"}
            </button>

            {bioAvailable && (
              <button
                onClick={() => { setMode("bio"); setPassError(""); setPassword(""); }}
                className="text-white/40 text-xs hover:text-white/60 transition-colors"
              >
                👆 Utiliser la biométrie
              </button>
            )}
          </div>
        )}
      </div>

      {/* Bottom - Full logout */}
      <button onClick={handleFullLogout} className="text-xs text-white/20 hover:text-white/40 transition-colors">
        Changer de compte
      </button>

      <style>{`@keyframes pulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.08);opacity:.7}}`}</style>
    </div>
  );
}
