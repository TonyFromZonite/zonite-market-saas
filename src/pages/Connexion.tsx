import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff } from "lucide-react";
import { createPageUrl } from "@/utils";
import { LOGO_URL as LOGO } from "@/components/constants";
import { Link } from "react-router-dom";

const MESSAGES_MOTIVATION = [
  "Chaque vente est une victoire. Allons-y ! 🚀",
  "Votre succès commence ici. Bienvenue ! 💪",
  "Ensemble, construisons quelque chose de grand. ✨",
  "Les champions se connectent tôt. C'est votre heure ! 🏆",
  "Prêt à performer aujourd'hui ? On vous attend ! 🔥",
];

const MODE_VENDEUR = "vendeur";
const MODE_ADMIN = "admin";

export default function Connexion() {
  const [mode, setMode] = useState(MODE_VENDEUR);
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [mdpVisible, setMdpVisible] = useState(false);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState("");
  const [msgIndex] = useState(() => Math.floor(Math.random() * MESSAGES_MOTIVATION.length));

  const connexionVendeur = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !motDePasse) { setErreur("Veuillez remplir tous les champs."); return; }
    setChargement(true);
    setErreur("");
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password: motDePasse });
      if (error) throw error;
      
      const { data: seller } = await supabase.from('sellers').select('*').eq('email', email).single();
      if (!seller) { setErreur("Compte vendeur introuvable."); setChargement(false); return; }
      
      if (seller.role === 'admin' || seller.role === 'sous_admin') {
        setErreur("Utilisez l'espace Admin pour vous connecter."); setChargement(false); return;
      }
      
      sessionStorage.setItem("vendeur_session", JSON.stringify({ ...seller, role: 'vendeur' }));
      window.location.href = createPageUrl("EspaceVendeur");
    } catch (err: any) {
      setErreur(err.message || "Identifiants incorrects.");
    }
    setChargement(false);
  };

  const connexionAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !motDePasse) { setErreur("Veuillez remplir tous les champs."); return; }
    setChargement(true);
    setErreur("");
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password: motDePasse });
      if (error) throw error;
      
      const { data: seller } = await supabase.from('sellers').select('*').eq('email', email).single();
      if (!seller) { setErreur("Compte introuvable."); setChargement(false); return; }
      
      if (seller.role === 'admin') {
        sessionStorage.setItem("admin_session", JSON.stringify({ ...seller, role: 'admin' }));
        window.location.href = createPageUrl("TableauDeBord");
      } else if (seller.role === 'sous_admin') {
        const { data: sa } = await supabase.from('sous_admins').select('permissions').eq('seller_id', seller.id).single();
        sessionStorage.setItem("sous_admin", JSON.stringify({ ...seller, role: 'sous_admin', permissions: sa?.permissions || [] }));
        window.location.href = createPageUrl("TableauDeBord");
      } else {
        setErreur("Accès non autorisé.");
      }
    } catch (err: any) {
      setErreur(err.message || "Erreur lors de la connexion.");
    }
    setChargement(false);
  };

  const changerMode = (m: string) => { setMode(m); setErreur(""); setEmail(""); setMotDePasse(""); };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "linear-gradient(135deg, #0d1240 0%, #1a1f5e 50%, #2d34a5 100%)" }}>
      <div className="w-full max-w-md">
        {/* Decorations */}
        <div className="absolute top-10 left-10 w-32 h-32 bg-[#F5C518]/10 rounded-full blur-3xl" />
        <div className="absolute bottom-10 right-10 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl" />

        {/* Logo + Title */}
        <div className="text-center mb-8">
          <img src={LOGO} alt="Logo" className="w-20 h-20 rounded-full mx-auto mb-4 object-cover shadow-xl border-2 border-[#F5C518]/30" />
          <h1 className="text-2xl md:text-3xl font-bold text-white">
            ZONITE <span style={{ color: "#F5C518" }}>Vendeurs</span>
          </h1>
          <p className="text-slate-300 text-sm mt-2">{MESSAGES_MOTIVATION[msgIndex]}</p>
        </div>

        {/* Mode selector */}
        <div className="flex gap-2 mb-6 bg-white/5 backdrop-blur-sm p-1 rounded-xl">
          <button
            onClick={() => changerMode(MODE_VENDEUR)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${mode === MODE_VENDEUR ? "bg-[#F5C518] text-[#1a1f5e] shadow" : "text-slate-300 hover:text-white"}`}
          >
            👤 Espace Vendeur
          </button>
          <button
            onClick={() => changerMode(MODE_ADMIN)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${mode === MODE_ADMIN ? "bg-white text-[#1a1f5e] shadow" : "text-slate-300 hover:text-white"}`}
          >
            🔐 Espace Admin
          </button>
        </div>

        {/* Form */}
        <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-6">
          {mode === MODE_VENDEUR ? (
            <form onSubmit={connexionVendeur} className="space-y-4">
              <div>
                <h2 className="text-lg font-bold text-white">Connexion Vendeur</h2>
                <p className="text-xs text-slate-400 mt-1">Entrez vos identifiants.</p>
              </div>
              <div>
                <label className="text-xs text-slate-300 mb-1 block">Email</label>
                <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="votre@email.com" className="bg-white/10 border-white/20 text-white placeholder:text-slate-400 focus:border-[#F5C518] rounded-xl h-11" />
              </div>
              <div>
                <label className="text-xs text-slate-300 mb-1 block">Mot de passe</label>
                <div className="relative">
                  <Input type={mdpVisible ? "text" : "password"} value={motDePasse} onChange={e => setMotDePasse(e.target.value)} placeholder="••••••••" className="bg-white/10 border-white/20 text-white placeholder:text-slate-400 focus:border-[#F5C518] rounded-xl h-11 pr-12" />
                  <button type="button" onClick={() => setMdpVisible(!mdpVisible)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
                    {mdpVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              {erreur && <p className="text-red-400 text-xs bg-red-500/10 rounded-lg px-3 py-2">{erreur}</p>}
              <Button type="submit" disabled={chargement} className="w-full h-11 rounded-xl font-bold text-sm" style={{ background: "#F5C518", color: "#1a1f5e" }}>
                {chargement ? "Vérification..." : "Se connecter →"}
              </Button>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 text-xs">Pas de compte ?</span>
                <Link to={createPageUrl("InscriptionVendeur")} className="text-[#F5C518] text-xs font-medium hover:underline">
                  Créer mon compte →
                </Link>
              </div>
            </form>
          ) : (
            <form onSubmit={connexionAdmin} className="space-y-4">
              <div>
                <h2 className="text-lg font-bold text-white">Connexion Administrateur</h2>
                <p className="text-xs text-slate-400 mt-1">Sous-admins : utilisez vos identifiants attribués.</p>
              </div>
              <div>
                <label className="text-xs text-slate-300 mb-1 block">Email</label>
                <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="email@example.com" className="bg-white/10 border-white/20 text-white placeholder:text-slate-400 focus:border-[#F5C518] rounded-xl h-11" />
              </div>
              <div>
                <label className="text-xs text-slate-300 mb-1 block">Mot de passe</label>
                <div className="relative">
                  <Input type={mdpVisible ? "text" : "password"} value={motDePasse} onChange={e => setMotDePasse(e.target.value)} placeholder="••••••••" className="bg-white/10 border-white/20 text-white placeholder:text-slate-400 focus:border-[#F5C518] rounded-xl h-11 pr-12" />
                  <button type="button" onClick={() => setMdpVisible(!mdpVisible)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
                    {mdpVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              {erreur && <p className="text-red-400 text-xs bg-red-500/10 rounded-lg px-3 py-2">{erreur}</p>}
              <Button type="submit" disabled={chargement} className="w-full h-11 rounded-xl font-bold text-sm bg-white text-[#1a1f5e] hover:bg-gray-100">
                {chargement ? "Vérification..." : "Accéder au panneau admin →"}
              </Button>
            </form>
          )}
        </div>

        <p className="text-center text-slate-500 text-xs mt-6">© {new Date().getFullYear()} ZONITE — Tous droits réservés</p>
      </div>
    </div>
  );
}
