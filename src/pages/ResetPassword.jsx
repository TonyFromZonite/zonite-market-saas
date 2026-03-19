import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff, CheckCircle2, Loader2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { LOGO_URL as LOGO } from "@/components/constants";
import { supabase } from "@/integrations/supabase/client";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [nouveauMdp, setNouveauMdp] = useState("");
  const [confirmerMdp, setConfirmerMdp] = useState("");
  const [mdpVisible, setMdpVisible] = useState(false);
  const [mdpVisible2, setMdpVisible2] = useState(false);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState("");
  const [succes, setSucces] = useState(false);
  const [validSession, setValidSession] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // Supabase handles the recovery token from the URL hash automatically.
    // We listen for the PASSWORD_RECOVERY event to know the session is valid.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" && session) {
        setValidSession(true);
        setChecking(false);
      }
    });

    // Also check if there's already a session (user clicked link and session was set)
    const checkSession = async () => {
      // Give Supabase a moment to process the hash
      await new Promise(r => setTimeout(r, 1500));
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        setValidSession(true);
      }
      setChecking(false);
    };
    checkSession();

    return () => subscription.unsubscribe();
  }, []);

  const soumettre = async (e) => {
    e.preventDefault();
    setErreur("");

    if (nouveauMdp.length < 8) {
      setErreur("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (nouveauMdp !== confirmerMdp) {
      setErreur("Les mots de passe ne correspondent pas.");
      return;
    }

    setChargement(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: nouveauMdp });
      if (error) throw error;
      setSucces(true);
      // Sign out and redirect after 3s
      setTimeout(async () => {
        await supabase.auth.signOut();
        navigate(createPageUrl("Connexion"));
      }, 3000);
    } catch (err) {
      setErreur(err.message || "Erreur lors de la réinitialisation. Réessayez.");
    }
    setChargement(false);
  };

  const matchOk = confirmerMdp && confirmerMdp === nouveauMdp;
  const matchBad = confirmerMdp && confirmerMdp !== nouveauMdp;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0d1240] to-[#1a1f5e] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <img src={LOGO} alt="Zonite" className="h-10 w-10 rounded-xl object-contain bg-white p-0.5" />
          <div>
            <p className="text-white font-black text-base leading-none">ZONITE</p>
            <p className="text-[#F5C518] text-[10px] font-semibold tracking-widest">VENDEURS</p>
          </div>
        </div>

        <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-6 border border-white/20 shadow-2xl">
          {checking ? (
            <div className="text-center py-8">
              <Loader2 className="w-8 h-8 text-[#F5C518] animate-spin mx-auto mb-3" />
              <p className="text-slate-300 text-sm">Vérification du lien...</p>
            </div>
          ) : !validSession ? (
            <div className="text-center py-6">
              <div className="text-4xl mb-3">❌</div>
              <h2 className="text-white font-bold text-lg mb-2">Lien invalide ou expiré</h2>
              <p className="text-slate-300 text-xs mb-4">Ce lien de réinitialisation n'est plus valide. Veuillez faire une nouvelle demande.</p>
              <Link to={createPageUrl("Connexion")}>
                <Button className="w-full bg-[#F5C518] hover:bg-[#e0b010] text-[#1a1f5e] font-black rounded-xl h-11">
                  Retour à la connexion →
                </Button>
              </Link>
            </div>
          ) : succes ? (
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              </div>
              <h2 className="text-white font-bold text-lg mb-2">Mot de passe modifié !</h2>
              <p className="text-slate-300 text-sm mb-2">Votre mot de passe a été mis à jour avec succès.</p>
              <p className="text-slate-400 text-xs">Redirection vers la connexion...</p>
            </div>
          ) : (
            <>
              <h2 className="text-white font-bold text-xl mb-1">🔑 Nouveau mot de passe</h2>
              <p className="text-slate-300 text-xs mb-5">Choisissez un mot de passe sécurisé (min. 8 caractères).</p>
              <form onSubmit={soumettre} className="space-y-4">
                <div>
                  <label className="text-slate-200 text-xs font-medium block mb-1.5">Nouveau mot de passe</label>
                  <div className="relative">
                    <Input
                      type={mdpVisible ? "text" : "password"}
                      value={nouveauMdp}
                      onChange={(e) => setNouveauMdp(e.target.value)}
                      placeholder="Minimum 8 caractères"
                      className="bg-white/10 border-white/20 text-white placeholder:text-slate-400 rounded-xl h-11 pr-12"
                    />
                    <button type="button" onClick={() => setMdpVisible(!mdpVisible)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
                      {mdpVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-slate-200 text-xs font-medium block mb-1.5">Confirmer le mot de passe</label>
                  <div className="relative">
                    <Input
                      type={mdpVisible2 ? "text" : "password"}
                      value={confirmerMdp}
                      onChange={(e) => setConfirmerMdp(e.target.value)}
                      placeholder="Répétez le mot de passe"
                      className={`bg-white/10 border-white/20 text-white placeholder:text-slate-400 rounded-xl h-11 pr-12 ${matchOk ? 'border-emerald-400/50' : matchBad ? 'border-red-400/50' : ''}`}
                    />
                    <button type="button" onClick={() => setMdpVisible2(!mdpVisible2)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
                      {mdpVisible2 ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {matchBad && <p className="text-red-400 text-[11px] mt-1">❌ Les mots de passe ne correspondent pas</p>}
                  {matchOk && <p className="text-emerald-400 text-[11px] mt-1">✅ Les mots de passe correspondent</p>}
                </div>
                {erreur && (
                  <div className="bg-red-500/20 border border-red-400/30 rounded-xl px-4 py-2.5">
                    <p className="text-red-300 text-xs">{erreur}</p>
                  </div>
                )}
                <Button
                  type="submit"
                  disabled={chargement || !nouveauMdp || nouveauMdp.length < 8 || nouveauMdp !== confirmerMdp}
                  className="w-full h-11 bg-[#F5C518] hover:bg-[#e0b010] text-[#1a1f5e] font-black rounded-xl"
                >
                  {chargement ? <Loader2 className="w-4 h-4 animate-spin" /> : "🔑 Mettre à jour le mot de passe"}
                </Button>
              </form>
              <div className="mt-4 text-center">
                <Link to={createPageUrl("Connexion")} className="text-slate-400 text-xs hover:text-[#F5C518] transition-colors">
                  ← Retour à la connexion
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
