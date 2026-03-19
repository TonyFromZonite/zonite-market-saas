/**
 * BiometricLock — verrouillage biométrique de session après inactivité.
 * Utilise l'API Web Authentication (WebAuthn) pour empreinte/Face ID.
 * Fallback : mot de passe Supabase.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getActiveSession } from "@/components/useSessionGuard";
import { Lock, Fingerprint, Eye, EyeOff } from "lucide-react";

const INACTIVITY_MS = 2 * 60 * 1000; // 2 minutes
const CREDENTIAL_KEY = "zonite_bio_cred_id";
const BIO_ENROLLED_KEY = "zonite_bio_enrolled";
const EVENTS = ["pointerdown", "keydown", "scroll", "touchstart"];

// ── WebAuthn helpers ──────────────────────────────
function bufToBase64(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}
function base64ToBuf(b64) {
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

function webAuthnSupported() {
  return !!(window.PublicKeyCredential && navigator.credentials);
}

async function enrollBiometric(userId) {
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const credential = await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: "Zonite Market", id: window.location.hostname },
      user: {
        id: new TextEncoder().encode(userId),
        name: "vendeur",
        displayName: "Vendeur Zonite",
      },
      pubKeyCredParams: [{ alg: -7, type: "public-key" }],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required",
      },
      timeout: 60000,
    },
  });
  const credId = bufToBase64(credential.rawId);
  localStorage.setItem(CREDENTIAL_KEY, credId);
  localStorage.setItem(BIO_ENROLLED_KEY, "1");
  return credId;
}

async function verifyBiometric() {
  const storedId = localStorage.getItem(CREDENTIAL_KEY);
  if (!storedId) throw new Error("no_credential");
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  await navigator.credentials.get({
    publicKey: {
      challenge,
      allowCredentials: [{ id: base64ToBuf(storedId), type: "public-key" }],
      userVerification: "required",
      timeout: 60000,
    },
  });
  return true;
}

// ── Component ─────────────────────────────────────
export default function BiometricLock() {
  const [locked, setLocked] = useState(false);
  const [showEnroll, setShowEnroll] = useState(false);
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [bioAvailable, setBioAvailable] = useState(false);
  const timerRef = useRef(null);
  const lockedRef = useRef(false);

  // Check biometric support on mount
  useEffect(() => {
    if (webAuthnSupported()) {
      PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable?.()
        .then(ok => setBioAvailable(ok))
        .catch(() => {});
    }
  }, []);

  // Prompt enrollment once if biometric available but not enrolled
  useEffect(() => {
    const session = getActiveSession();
    if (
      bioAvailable &&
      session &&
      !localStorage.getItem(BIO_ENROLLED_KEY) &&
      !sessionStorage.getItem("zonite_bio_prompt_dismissed")
    ) {
      const t = setTimeout(() => setShowEnroll(true), 3000);
      return () => clearTimeout(t);
    }
  }, [bioAvailable]);

  const resetTimer = useCallback(() => {
    if (lockedRef.current) return;
    clearTimeout(timerRef.current);
    const session = getActiveSession();
    if (!session) return;
    timerRef.current = setTimeout(() => {
      lockedRef.current = true;
      setLocked(true);
    }, INACTIVITY_MS);
  }, []);

  // Inactivity tracker
  useEffect(() => {
    const session = getActiveSession();
    if (!session) return;

    resetTimer();
    EVENTS.forEach(e => window.addEventListener(e, resetTimer, { passive: true }));
    return () => {
      clearTimeout(timerRef.current);
      EVENTS.forEach(e => window.removeEventListener(e, resetTimer));
    };
  }, [resetTimer]);

  // Auto-trigger biometric when locked
  useEffect(() => {
    if (locked && bioAvailable && localStorage.getItem(BIO_ENROLLED_KEY)) {
      handleBiometricUnlock();
    }
  }, [locked]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleBiometricUnlock = async () => {
    setError("");
    setLoading(true);
    try {
      await verifyBiometric();
      unlock();
    } catch {
      setError("Échec biométrique. Utilisez votre mot de passe.");
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordUnlock = async () => {
    if (!password.trim()) return;
    setError("");
    setLoading(true);
    try {
      const session = getActiveSession();
      const email = session?.data?.email;
      if (!email) throw new Error("no_email");
      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) throw err;
      unlock();
    } catch {
      setError("Mot de passe incorrect.");
    } finally {
      setLoading(false);
    }
  };

  const unlock = () => {
    setLocked(false);
    lockedRef.current = false;
    setPassword("");
    setError("");
    resetTimer();
  };

  const handleEnroll = async () => {
    try {
      const session = getActiveSession();
      await enrollBiometric(session?.data?.id || "user");
      setShowEnroll(false);
    } catch {
      setShowEnroll(false);
    }
  };

  const dismissEnroll = () => {
    sessionStorage.setItem("zonite_bio_prompt_dismissed", "1");
    setShowEnroll(false);
  };

  // ── Enrollment prompt ───────────────────────────
  if (showEnroll) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div className="w-full max-w-sm rounded-2xl bg-card p-6 text-card-foreground shadow-2xl space-y-4 animate-in slide-in-from-bottom-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <Fingerprint className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="font-bold text-base">Verrouillage biométrique</h3>
              <p className="text-xs text-muted-foreground">Sécurisez votre session</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Activez l'empreinte digitale ou Face ID pour déverrouiller rapidement après une période d'inactivité.
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleEnroll}
              className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              ✅ Activer
            </button>
            <button
              onClick={dismissEnroll}
              className="flex-1 rounded-lg bg-muted px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted/80 transition-colors"
            >
              Plus tard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Lock screen ─────────────────────────────────
  if (!locked) return null;

  const session = getActiveSession();
  const name = session?.data?.nom_complet || session?.data?.email || "";
  const hasBio = bioAvailable && localStorage.getItem(BIO_ENROLLED_KEY);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#1a1f4e] p-4">
      <div className="w-full max-w-sm space-y-6 text-center">
        {/* Avatar */}
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-white/10 ring-4 ring-white/20">
          <Lock className="h-8 w-8 text-[#F5C518]" />
        </div>

        <div>
          <h2 className="text-xl font-bold text-white">Session verrouillée</h2>
          <p className="mt-1 text-sm text-white/60">{name}</p>
        </div>

        {error && (
          <div className="rounded-lg bg-red-500/20 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* Biometric button */}
        {hasBio && (
          <button
            onClick={handleBiometricUnlock}
            disabled={loading}
            className="mx-auto flex items-center gap-2 rounded-xl bg-[#F5C518] px-6 py-3 text-sm font-bold text-[#1a1f4e] hover:bg-[#e8b800] transition-colors disabled:opacity-50"
          >
            <Fingerprint className="h-5 w-5" />
            {loading ? "Vérification…" : "Déverrouiller"}
          </button>
        )}

        {/* Divider */}
        {hasBio && (
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-white/20" />
            <span className="text-xs text-white/40">ou</span>
            <div className="h-px flex-1 bg-white/20" />
          </div>
        )}

        {/* Password fallback */}
        <div className="space-y-3">
          <div className="relative">
            <input
              type={showPwd ? "text" : "password"}
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handlePasswordUnlock()}
              placeholder="Mot de passe"
              className="w-full rounded-xl bg-white/10 px-4 py-3 pr-12 text-sm text-white placeholder:text-white/40 border border-white/20 focus:border-[#F5C518] focus:outline-none transition-colors"
            />
            <button
              type="button"
              onClick={() => setShowPwd(!showPwd)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70"
            >
              {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <button
            onClick={handlePasswordUnlock}
            disabled={loading || !password.trim()}
            className="w-full rounded-xl bg-white/10 py-3 text-sm font-semibold text-white hover:bg-white/20 transition-colors disabled:opacity-40"
          >
            {loading ? "⏳ Vérification…" : "🔓 Déverrouiller avec mot de passe"}
          </button>
        </div>
      </div>
    </div>
  );
}
