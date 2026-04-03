import React, { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, ChevronLeft } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { createPageUrl } from "@/utils";
import { LOGO_URL as LOGO } from "@/components/constants";

export default function MotDePasseOublie() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !email.includes("@")) {
      toast({ title: "❌ Email invalide", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        email.trim().toLowerCase(),
        { redirectTo: `${window.location.origin}/ResetPassword` }
      );

      if (error) {
        if (error.message?.includes("rate limit")) {
          toast({ title: "⏳ Trop de tentatives", description: "Attendez quelques minutes.", variant: "destructive" });
        } else {
          toast({ title: "❌ Erreur", description: "Impossible d'envoyer l'email.", variant: "destructive" });
        }
        return;
      }

      setSent(true);
    } catch {
      toast({ title: "❌ Erreur", description: "Réessayez.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

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
          {sent ? (
            <div className="text-center py-4">
              <div className="text-4xl mb-3">📬</div>
              <h2 className="text-white font-bold text-lg mb-2">Email envoyé !</h2>
              <p className="text-slate-300 text-sm mb-1">
                Un lien de réinitialisation a été envoyé à
              </p>
              <p className="text-[#F5C518] font-semibold text-sm mb-4">{email}</p>
              <p className="text-slate-400 text-xs mb-4">
                ⚠️ Vérifiez aussi vos spams. Le lien expire dans 1 heure.
              </p>
              <Button onClick={() => navigate("/Connexion")}
                className="w-full bg-[#F5C518] hover:bg-[#e0b010] text-[#1a1f5e] font-black rounded-xl h-11">
                Retour à la connexion →
              </Button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-5">
                <Link to={createPageUrl("Connexion")}>
                  <button className="w-8 h-8 bg-white/10 rounded-xl flex items-center justify-center">
                    <ChevronLeft className="w-5 h-5 text-white" />
                  </button>
                </Link>
                <div>
                  <h2 className="text-white font-bold text-lg">🔑 Mot de passe oublié</h2>
                  <p className="text-slate-300 text-xs">Entrez votre email pour recevoir un lien de réinitialisation.</p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-slate-200 text-xs font-medium block mb-1.5">Adresse email du compte</label>
                  <Input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="votre@email.com"
                    autoFocus
                    className="bg-white/10 border-white/20 text-white placeholder:text-slate-400 rounded-xl h-11"
                  />
                  <p className="text-slate-400 text-[10px] mt-1">
                    📧 Un lien de réinitialisation sera envoyé à cet email
                  </p>
                </div>

                <Button type="submit" disabled={loading || !email.includes("@")}
                  className="w-full h-11 bg-[#F5C518] hover:bg-[#e0b010] text-[#1a1f5e] font-black rounded-xl">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "📧 Envoyer le lien"}
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
