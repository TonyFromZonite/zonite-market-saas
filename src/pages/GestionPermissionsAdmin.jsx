import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { adminApi } from "@/components/adminApi";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Pencil, Trash2, ShieldCheck } from "lucide-react";
import { showSuccess, showError, showWarning } from "@/components/NotificationSystem";

const MODULES_DISPONIBLES = [
  { id: "TableauDeBord",     label: "Tableau de Bord" },
  { id: "NouvelleVente",     label: "Nouvelle Vente" },
  { id: "Commandes",         label: "Commandes Admin" },
  { id: "CommandesVendeurs", label: "Commandes Vendeurs" },
  { id: "Produits",          label: "Produits" },
  { id: "Vendeurs",          label: "Vendeurs" },
  { id: "Livraisons",        label: "Livraisons" },
  { id: "SupportAdmin",      label: "Support Vendeurs" },
  { id: "JournalAudit",      label: "Journal d'Audit" },
  { id: "ConfigurationApp",  label: "Configuration App" },
];

export default function GestionPermissionsAdmin() {
  const [permissions, setPermissions] = useState([]);
  const [sousAdmins, setSousAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPerm, setEditingPerm] = useState(null);
  const [selectedModules, setSelectedModules] = useState([]);

  const charger = async () => {
    try {
      const [{ data: perms }, { data: admins }] = await Promise.all([
        supabase.from("admin_permissions").select("*").order("created_at", { ascending: false }),
        supabase.from("sous_admins").select("id, full_name, email, actif"),
      ]);
      setPermissions(perms || []);
      setSousAdmins(admins || []);
    } catch (error) {
      showError("Erreur au chargement des permissions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { charger(); }, []);

  const getSousAdminName = (perm) => {
    const sa = sousAdmins.find(s => s.id === perm.sous_admin_id);
    return sa?.full_name || perm.sous_admin_email || "—";
  };

  const handleEdit = (perm) => {
    setEditingPerm(perm);
    setSelectedModules(Array.isArray(perm.modules_autorises) ? perm.modules_autorises : []);
    setDialogOpen(true);
  };

  const toggleModule = (id) => {
    setSelectedModules(prev =>
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    );
  };

  const sauvegarder = async () => {
    if (!editingPerm || selectedModules.length === 0) {
      showWarning("Sélectionnez au moins un module");
      return;
    }
    try {
      await adminApi.updateAdminPermissions(editingPerm.id, {
        modules_autorises: selectedModules,
      });
      showSuccess("Permissions mises à jour");
      setDialogOpen(false);
      charger();
    } catch (error) {
      showError("Erreur lors de la sauvegarde");
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Supprimer ces permissions ?")) return;
    try {
      await adminApi.deleteAdminPermissions(id);
      setPermissions(prev => prev.filter(p => p.id !== id));
      showSuccess("Permissions supprimées");
    } catch (error) {
      showError("Erreur lors de la suppression");
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><span className="text-slate-500">Chargement...</span></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Permissions Admin</h1>
        <p className="text-sm text-slate-600 mt-1">
          Gérez les accès aux modules pour chaque sous-administrateur.
          Les permissions sont créées automatiquement lors de la création d'un sous-admin.
        </p>
      </div>

      <div className="grid gap-4">
        {permissions.length === 0 ? (
          <Card className="p-8 text-center">
            <ShieldCheck className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">Aucune permission configurée</p>
            <p className="text-xs text-slate-400 mt-1">Créez un sous-admin dans la page Sous-Admins pour ajouter des permissions.</p>
          </Card>
        ) : (
          permissions.map((perm) => {
            const modules = Array.isArray(perm.modules_autorises) ? perm.modules_autorises : [];
            return (
              <Card key={perm.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <ShieldCheck className="w-4 h-4 text-[#1a1f5e]" />
                      <h3 className="font-semibold text-slate-900">{getSousAdminName(perm)}</h3>
                    </div>
                    <p className="text-xs text-slate-500 mb-3">{perm.sous_admin_email}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {modules.length > 0 ? modules.map((mod) => {
                        const m = MODULES_DISPONIBLES.find(x => x.id === mod);
                        return (
                          <Badge key={mod} variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
                            {m?.label || mod}
                          </Badge>
                        );
                      }) : (
                        <span className="text-xs text-slate-400">Aucun module autorisé</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => handleEdit(perm)} className="text-blue-600 hover:bg-blue-50">
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => handleDelete(perm.id)} className="text-red-600 hover:bg-red-50">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Modifier les permissions</DialogTitle>
          </DialogHeader>
          {editingPerm && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                Permissions pour <strong>{getSousAdminName(editingPerm)}</strong> ({editingPerm.sous_admin_email})
              </p>
              <div className="grid grid-cols-1 gap-2 bg-slate-50 rounded-lg p-3">
                {MODULES_DISPONIBLES.map((m) => (
                  <label key={m.id} className="flex items-center gap-2 cursor-pointer hover:bg-white p-1.5 rounded transition">
                    <Checkbox
                      checked={selectedModules.includes(m.id)}
                      onCheckedChange={() => toggleModule(m.id)}
                    />
                    <span className="text-sm text-slate-700">{m.label}</span>
                  </label>
                ))}
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
                <Button className="bg-[#1a1f5e] hover:bg-[#141952]" onClick={sauvegarder}>
                  Mettre à jour
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
