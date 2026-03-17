import React, { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "@/components/adminApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, UserCog, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const MODULES_DISPONIBLES = [
  { id: "TableauDeBord",     label: "Tableau de Bord" },
  { id: "NouvelleVente",     label: "Nouvelle Vente" },
  { id: "Commandes",         label: "Commandes Admin" },
  { id: "CommandesVendeurs", label: "Commandes Vendeurs" },
  { id: "Produits",          label: "Produits" },
  { id: "Vendeurs",          label: "Vendeurs" },
  { id: "Livraisons",        label: "Livraisons" },
  { id: "SupportAdmin",      label: "Support Vendeurs" },
  { id: "JournalAudit",      label: "Journal d'Audit & Rapports" },
];

const VIDE = {
  full_name: "",
  nom_role: "",
  username: "",
  email: "",
  mot_de_passe: "",
  permissions: [],
  notes: "",
};

export default function GestionSousAdmins() {
  const [dialogOuvert, setDialogOuvert] = useState(false);
  const [form, setForm] = useState(VIDE);
  const [editing, setEditing] = useState(null);
  const [mdpVisible, setMdpVisible] = useState(false);
  const [chargement, setChargement] = useState(false);
  const [permissionsMap, setPermissionsMap] = useState({});
  const queryClient = useQueryClient();

  const { data: sousAdmins = [], isLoading } = useQuery({
    queryKey: ["sous_admins"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sous_admins").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Load permissions for all sous-admins
  useEffect(() => {
    const loadPermissions = async () => {
      if (sousAdmins.length === 0) return;
      const { data } = await supabase.from("admin_permissions").select("*");
      const map = {};
      (data || []).forEach(p => {
        if (p.sous_admin_id) {
          map[p.sous_admin_id] = Array.isArray(p.modules_autorises) ? p.modules_autorises : [];
        }
      });
      setPermissionsMap(map);
    };
    loadPermissions();
  }, [sousAdmins]);

  const ouvrirCreation = () => {
    setEditing(null);
    setForm(VIDE);
    setMdpVisible(false);
    setDialogOuvert(true);
  };

  const ouvrirEdition = (sa) => {
    setEditing(sa);
    setForm({
      full_name: sa.full_name || "",
      nom_role: sa.nom_role || "",
      username: sa.username || "",
      email: sa.email || "",
      mot_de_passe: "",
      permissions: permissionsMap[sa.id] || [],
      notes: "",
    });
    setMdpVisible(false);
    setDialogOuvert(true);
  };

  const togglePermission = (id) => {
    setForm((f) => ({
      ...f,
      permissions: f.permissions.includes(id)
        ? f.permissions.filter((p) => p !== id)
        : [...f.permissions, id],
    }));
  };

  const toutSelectionner = () => {
    setForm((f) => ({
      ...f,
      permissions: f.permissions.length === MODULES_DISPONIBLES.length
        ? []
        : MODULES_DISPONIBLES.map((m) => m.id),
    }));
  };

  const sauvegarder = async () => {
    if (!form.full_name || !form.nom_role || !form.username || !form.email) return;
    if (!editing && !form.mot_de_passe) return;
    setChargement(true);
    try {
      if (editing) {
        // Update sous_admin
        await adminApi.updateSousAdmin(editing.id, {
          full_name: form.full_name,
          nom_role: form.nom_role,
          username: form.username,
        });

        // Update password if provided
        if (form.mot_de_passe && editing.user_id) {
          await supabase.functions.invoke("seed-admin", {
            body: { action: "update_password", user_id: editing.user_id, password: form.mot_de_passe },
          });
        }

        // Upsert permissions
        await adminApi.upsertPermissionsForSousAdmin(editing.id, editing.email, form.permissions);
      } else {
        // Create auth user
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: form.email.trim().toLowerCase(),
          password: form.mot_de_passe,
          options: {
            data: { role: "sous_admin", full_name: form.full_name },
          },
        });

        if (authError) throw authError;

        // Create sous_admin record
        const result = await adminApi.createSousAdmin({
          full_name: form.full_name,
          nom_role: form.nom_role,
          username: form.username,
          email: form.email.trim().toLowerCase(),
          user_id: authData.user?.id || null,
        });

        // Create user_roles entry
        if (authData.user?.id) {
          await supabase.from("user_roles").insert({
            user_id: authData.user.id,
            role: "sous_admin",
          });
        }

        // Create permissions
        if (result?.id) {
          await adminApi.upsertPermissionsForSousAdmin(result.id, form.email, form.permissions);
        }
      }

      queryClient.invalidateQueries({ queryKey: ["sous_admins"] });
      setDialogOuvert(false);
    } catch (err) {
      console.error("Erreur lors de la sauvegarde:", err);
      alert("Erreur : " + (err.message || "Échec de la sauvegarde"));
    } finally {
      setChargement(false);
    }
  };

  const supprimer = async (id) => {
    if (!confirm("Supprimer ce sous-administrateur ?")) return;
    await adminApi.deleteSousAdmin(id);
    queryClient.invalidateQueries({ queryKey: ["sous_admins"] });
  };

  const toggleStatut = async (sa) => {
    await adminApi.updateSousAdmin(sa.id, { actif: !sa.actif });
    queryClient.invalidateQueries({ queryKey: ["sous_admins"] });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Sous-Administrateurs</h2>
          <p className="text-sm text-slate-500">Créez des comptes avec des accès limités aux modules que vous choisissez.</p>
        </div>
        <Button onClick={ouvrirCreation} className="bg-[#1a1f5e] hover:bg-[#141952]">
          <Plus className="w-4 h-4 mr-2" /> Nouveau sous-admin
        </Button>
      </div>

      {isLoading ? (
        <p className="text-slate-400 text-sm">Chargement...</p>
      ) : sousAdmins.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <UserCog className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">Aucun sous-administrateur créé.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {sousAdmins.map((sa) => (
            <div key={sa.id} className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <ShieldCheck className="w-4 h-4 text-[#1a1f5e]" />
                  <span className="font-semibold text-slate-900">{sa.full_name}</span>
                  <Badge className={sa.actif ? "bg-emerald-100 text-emerald-700 border-0" : "bg-red-100 text-red-700 border-0"}>
                    {sa.actif ? "Actif" : "Suspendu"}
                  </Badge>
                </div>
                <p className="text-xs text-slate-500 mb-1">
                  <span className="font-medium text-slate-700">{sa.nom_role || "—"}</span> · @{sa.username || "—"} · {sa.email}
                </p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {(permissionsMap[sa.id] || []).map((p) => {
                    const mod = MODULES_DISPONIBLES.find((m) => m.id === p);
                    return mod ? (
                      <span key={p} className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-[10px] font-medium">{mod.label}</span>
                    ) : null;
                  })}
                  {(permissionsMap[sa.id] || []).length === 0 && (
                    <span className="text-xs text-slate-400">Aucune permission</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Button variant="outline" size="sm" onClick={() => toggleStatut(sa)}>
                  {sa.actif ? "Suspendre" : "Activer"}
                </Button>
                <Button variant="ghost" size="icon" onClick={() => ouvrirEdition(sa)}>
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700" onClick={() => supprimer(sa.id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOuvert} onOpenChange={setDialogOuvert}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier le sous-admin" : "Nouveau sous-administrateur"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nom complet *</Label>
                <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="ex: Jean Dupont" />
              </div>
              <div>
                <Label>Titre du rôle *</Label>
                <Input value={form.nom_role} onChange={(e) => setForm({ ...form, nom_role: e.target.value })} placeholder="ex: Modérateur commandes" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nom d'utilisateur *</Label>
                <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="ex: jean.dupont" />
              </div>
              <div>
                <Label>Email *</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@exemple.com" disabled={!!editing} />
              </div>
            </div>
            <div>
              <Label>{editing ? "Nouveau mot de passe (laisser vide = inchangé)" : "Mot de passe *"}</Label>
              <div className="relative">
                <Input
                  type={mdpVisible ? "text" : "password"}
                  value={form.mot_de_passe}
                  onChange={(e) => setForm({ ...form, mot_de_passe: e.target.value })}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  onClick={() => setMdpVisible(!mdpVisible)}
                >
                  {mdpVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Modules accessibles</Label>
                <button type="button" className="text-xs text-blue-600 hover:underline" onClick={toutSelectionner}>
                  {form.permissions.length === MODULES_DISPONIBLES.length ? "Tout désélectionner" : "Tout sélectionner"}
                </button>
              </div>
              <div className="grid grid-cols-1 gap-2 bg-slate-50 rounded-lg p-3">
                {MODULES_DISPONIBLES.map((m) => (
                  <label key={m.id} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={form.permissions.includes(m.id)}
                      onCheckedChange={() => togglePermission(m.id)}
                    />
                    <span className="text-sm text-slate-700">{m.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialogOuvert(false)}>Annuler</Button>
              <Button
                className="bg-[#1a1f5e] hover:bg-[#141952]"
                onClick={sauvegarder}
                disabled={chargement || !form.full_name || !form.nom_role || !form.username || !form.email}
              >
                {chargement ? "Enregistrement..." : editing ? "Mettre à jour" : "Créer"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
