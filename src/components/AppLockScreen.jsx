import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Fingerprint, Lock } from "lucide-react";

export default function AppLockScreen({ onUnlock }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => triggerUnlock(), 600);
    return () => clearTimeout(t);
  }, []);

  const triggerUnlock = async () => {
    setLoading(true);
    setError("");
    try {
      const credential = await navigator.credentials.get({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          rpId: window.location.hostname,
          userVerification: "required",
          timeout: 60000,
          allowCredentials: [],
        },
        mediation: "optional",
      });
      if (credential) onUnlock();
    } catch (err) {
      setError(err.name === "NotAllowedError" ? "Vérification annulée. Réessayez." : "Échec. Réessayez.");
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordUnlock = async () => {
    if (!password.trim()) return;
    setLoading(true);
    setError("");
    try {
      const session = JSON.parse(localStorage.getItem("vendeur_session") || localStorage.getItem("admin_session") || "{}");
      const email = session?.email;
      if (!email) throw new Error("no_email");
      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) throw err;
      onUnlock();
    } catch {
      setError("Mot de passe incorrect.");
    } finally {
      setLoading(false);
    }
  };

  const session = JSON.parse(localStorage.getItem("vendeur_session") || localStorage.getItem("admin_session") || "{}");
  const name = session.nom_complet || session.full_name || session.email || "Utilisateur";
  const initials = name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

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
      <div className="flex flex-col items-center gap-5">
        <div className="w-20 h-20 rounded-full bg-white/10 ring-4 ring-white/20 flex items-center justify-center text-2xl font-bold text-[#F5C518]">
          {initials}
        </div>
        <div className="text-center">
          <p className="text-lg font-semibold text-white">{name}</p>
          <p className="text-xs text-white/40">Zonite Market</p>
        </div>

        {/* Biometric button */}
        <button
          onClick={triggerUnlock}
          disabled={loading}
          className="w-16 h-16 rounded-full bg-[#F5C518]/20 flex items-center justify-center transition-all hover:bg-[#F5C518]/30 disabled:opacity-50"
          style={loading ? { animation: "pulse 1.5s infinite" } : {}}
        >
          <Fingerprint className="w-8 h-8 text-[#F5C518]" />
        </button>
        <p className="text-xs text-white/40">{loading ? "Vérification…" : "Empreinte · Face ID · PIN"}</p>

        {error && <p className="text-xs text-red-400 bg-red-500/10 px-3 py-1.5 rounded-lg">{error}</p>}

        {/* Password fallback */}
        <div className="w-full max-w-[280px] space-y-2 mt-2">
          <input
            type={showPwd ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handlePasswordUnlock()}
            placeholder="Mot de passe"
            className="w-full rounded-xl bg-white/10 px-4 py-3 text-sm text-white placeholder:text-white/30 border border-white/10 focus:border-[#F5C518] focus:outline-none"
          />
          <button
            onClick={handlePasswordUnlock}
            disabled={loading || !password.trim()}
            className="w-full rounded-xl bg-white/10 py-2.5 text-sm font-medium text-white hover:bg-white/20 transition-colors disabled:opacity-40"
          >
            Déverrouiller
          </button>
        </div>
      </div>

      {/* Bottom */}
      <button
        onClick={() => {
          if (window.confirm("Se déconnecter complètement ?")) {
            supabase.auth.signOut();
            localStorage.removeItem("vendeur_session");
            localStorage.removeItem("admin_session");
            localStorage.removeItem("sous_admin");
            localStorage.removeItem("bio_enabled");
            window.location.href = "/Connexion";
          }
        }}
        className="text-xs text-white/20 hover:text-white/40 transition-colors"
      >
        Changer de compte
      </button>

      <style>{`@keyframes pulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.1);opacity:.7}}`}</style>
    </div>
  );
}
