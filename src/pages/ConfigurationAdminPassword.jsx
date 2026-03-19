import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";


export default function ConfigurationAdminPassword() {
  const [mdpActuel, setMdpActuel] = useState("");
  const [mdpNouveau, setMdpNouveau] = useState("");
  const [mdpConfirm, setMdpConfirm] = useState("");
  const [mdpVisible, setMdpVisible] = useState({ actuel: false, nouveau: false, confirm: false });
  const [erreur, setErreur] = useState("");
  const [succes, setSucces] = useState("");
  const [entraitement, setEntraitement] = useState(false);

  const changerMotDePasse = async (e) => {
    e.preventDefault();
    setErreur("");
    setSucces("");

    if (!mdpActuel) {
      setErreur("Veuillez entrer le mot de passe actuel.");
      return;
    }
    if (!mdpNouveau || !mdpConfirm) {
      setErreur("Tous les champs sont obligatoires.");
      return;
    }
    if (mdpNouveau !== mdpConfirm) {
      setErreur("Les deux nouveaux mots de passe ne correspondent pas.");
      return;
    }
    if (mdpNouveau.length < 6) {
      setErreur("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }

    setEntraitement(true);
    try {
      // Verify current password by re-signing in
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) throw new Error("Utilisateur non connecté.");

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: mdpActuel,
      });
      if (signInError) {
        setErreur("Mot de passe actuel incorrect.");
        setEntraitement(false);
        return;
      }

      // Update to new password
      const { error: updateError } = await supabase.auth.updateUser({
        password: mdpNouveau,
      });
      if (updateError) {
        setErreur(updateError.message || "Erreur lors de la mise à jour.");
        setEntraitement(false);
        return;
      }

      setSucces("Mot de passe mis à jour avec succès !");
      setMdpActuel("");
      setMdpNouveau("");
      setMdpConfirm("");
    } catch (err) {
      setErreur(err.message || "Erreur lors de la mise à jour du mot de passe.");
    }
    setEntraitement(false);
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="bg-white rounded-xl shadow-md border border-slate-200 p-6">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Sécurité Admin</h1>
        <p className="text-slate-500 text-sm mb-6">Gérez votre mot de passe pour l'accès mobile et web.</p>

        <form onSubmit={changerMotDePasse} className="space-y-5">
          {/* Mot de passe actuel */}
          <div>
            <label className="text-slate-700 font-medium text-sm block mb-2">Mot de passe actuel</label>
            <div className="relative">
              <Input
                type={mdpVisible.actuel ? "text" : "password"}
                value={mdpActuel}
                onChange={(e) => setMdpActuel(e.target.value)}
                placeholder="••••••••"
                className="bg-slate-50 border border-slate-300 pr-10"
              />
              <button
                type="button"
                onClick={() => setMdpVisible({ ...mdpVisible, actuel: !mdpVisible.actuel })}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {mdpVisible.actuel ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Nouveau mot de passe */}
          <div>
            <label className="text-slate-700 font-medium text-sm block mb-2">Nouveau mot de passe</label>
            <div className="relative">
              <Input
                type={mdpVisible.nouveau ? "text" : "password"}
                value={mdpNouveau}
                onChange={(e) => setMdpNouveau(e.target.value)}
                placeholder="••••••••"
                className="bg-slate-50 border border-slate-300 pr-10"
              />
              <button
                type="button"
                onClick={() => setMdpVisible({ ...mdpVisible, nouveau: !mdpVisible.nouveau })}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {mdpVisible.nouveau ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-slate-400 text-xs mt-2">Minimum 6 caractères</p>
          </div>

          {/* Confirmer mot de passe */}
          <div>
            <label className="text-slate-700 font-medium text-sm block mb-2">Confirmer le nouveau mot de passe</label>
            <div className="relative">
              <Input
                type={mdpVisible.confirm ? "text" : "password"}
                value={mdpConfirm}
                onChange={(e) => setMdpConfirm(e.target.value)}
                placeholder="••••••••"
                className="bg-slate-50 border border-slate-300 pr-10"
              />
              <button
                type="button"
                onClick={() => setMdpVisible({ ...mdpVisible, confirm: !mdpVisible.confirm })}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {mdpVisible.confirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {erreur && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-start gap-3">
              <X className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-red-700 text-sm">{erreur}</p>
            </div>
          )}

          {succes && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 flex items-start gap-3">
              <Check className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
              <p className="text-emerald-700 text-sm">{succes}</p>
            </div>
          )}

          <Button
            type="submit"
            disabled={entraitement}
            className="bg-[#1a1f5e] hover:bg-[#141952] text-white font-bold"
          >
            {entraitement ? "Mise à jour..." : "Changer le mot de passe"}
          </Button>
        </form>
      </div>
    </div>
  );
}