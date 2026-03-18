import React, { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { adminApi } from "@/components/adminApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { UserCog, ShieldCheck, Search, Loader2, UserPlus, Settings, Trash2, UserMinus, Pause, Play } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const ALL_MODULES = [
  { id: "TableauDeBord",     label: "Tableau de Bord" },
  { id: "NouvelleVente",     label: "Nouvelle Vente" },
  { id: "Commandes",         label: "Commandes Admin" },
  { id: "GestionCommandes",  label: "Gestion Livraisons" },
  { id: "CommandesVendeurs", label: "Commandes Vendeurs" },
  { id: "Produits",          label: "Produits" },
  { id: "Vendeurs",          label: "Vendeurs" },
  { id: "GestionKYC",        label: "Validation KYC" },
  { id: "GestionZones",      label: "Zones Livraison" },
  { id: "GestionCoursiers",  label: "Coursiers" },
  { id: "SupportAdmin",      label: "Support Vendeurs" },
  { id: "JournalAudit",      label: "Journal d'Audit" },
];

// ─── Admin Card ───
function AdminCard({ admin, onManage }) {
  const permissions = admin.admin_permissions?.[0]?.modules_autorises || [];

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition-shadow">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 text-sm font-bold text-primary">
            {admin.full_name?.[0]?.toUpperCase() || "?"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-slate-900 truncate">{admin.full_name}</span>
              <Badge className={admin.actif ? "bg-emerald-100 text-emerald-700 border-0" : "bg-red-100 text-red-700 border-0"}>
                {admin.actif ? "✅ Actif" : "⏸️ Suspendu"}
              </Badge>
            </div>
            <p className="text-xs text-slate-500 truncate">{admin.email}</p>
            {admin.nom_role && <p className="text-[10px] text-slate-400">{admin.nom_role}</p>}
            <div className="flex flex-wrap gap-1 mt-1.5">
              {permissions.length > 0 ? permissions.map(p => {
                const mod = ALL_MODULES.find(m => m.id === p);
                return (
                  <span key={p} className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-[10px] font-medium">
                    {mod?.label || p}
                  </span>
                );
              }) : (
                <span className="text-[10px] text-slate-400">Aucune permission</span>
              )}
            </div>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => onManage(admin)} className="w-full sm:w-auto">
          <Settings className="w-3.5 h-3.5 mr-1.5" /> Gérer
        </Button>
      </div>
    </div>
  );
}

// ─── Manage Admin Modal ───
function ManageAdminModal({ admin, onClose, onSuccess }) {
  const { toast } = useToast();
  const currentPerms = admin.admin_permissions?.[0]?.modules_autorises || [];
  const [permissions, setPermissions] = useState(currentPerms);
  const [loading, setLoading] = useState(false);

  const togglePermission = (id) => {
    setPermissions(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
  };

  const handleUpdatePermissions = async () => {
    if (permissions.length === 0) {
      toast({ title: "⚠️ Sélectionnez au moins un module", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      // Upsert permissions
      const { data: existing } = await supabase
        .from("admin_permissions")
        .select("id")
        .eq("sous_admin_id", admin.id)
        .maybeSingle();

      if (existing) {
        await supabase.from("admin_permissions").update({ modules_autorises: permissions }).eq("id", existing.id);
      } else {
        await supabase.from("admin_permissions").insert({
          sous_admin_id: admin.id,
          sous_admin_email: admin.email,
          modules_autorises: permissions,
        });
      }

      // Notify vendor
      if (admin.seller_id) {
        await supabase.from("notifications_vendeur").insert({
          vendeur_id: admin.seller_id,
          vendeur_email: admin.email,
          titre: "🔑 Permissions mises à jour",
          message: `Modules accessibles : ${permissions.map(p => ALL_MODULES.find(m => m.id === p)?.label || p).join(", ")}`,
          type: "info",
        });
      }

      toast({ title: "✅ Permissions mises à jour" });
      onSuccess();
    } catch (error) {
      toast({ title: "❌ Erreur", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async () => {
    setLoading(true);
    try {
      const newStatus = !admin.actif;
      await supabase.from("sous_admins").update({ actif: newStatus }).eq("id", admin.id);

      if (admin.user_id) {
        await supabase.from("user_roles").update({ role: newStatus ? "sous_admin" : "user" }).eq("user_id", admin.user_id);
      }

      if (admin.seller_id) {
        await supabase.from("notifications_vendeur").insert({
          vendeur_id: admin.seller_id,
          vendeur_email: admin.email,
          titre: newStatus ? "✅ Compte réactivé" : "⏸️ Compte suspendu",
          message: newStatus ? "Votre accès administrateur a été réactivé." : "Votre accès administrateur a été temporairement suspendu.",
          type: newStatus ? "succes" : "alerte",
        });
      }

      toast({ title: newStatus ? "✅ Compte réactivé" : "⏸️ Compte suspendu" });
      onSuccess();
    } catch (error) {
      toast({ title: "❌ Erreur", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleDemote = async () => {
    if (!confirm(`Rétrograder ${admin.full_name} en simple vendeur ?`)) return;
    setLoading(true);
    try {
      await supabase.from("admin_permissions").delete().eq("sous_admin_id", admin.id);
      await supabase.from("sous_admins").delete().eq("id", admin.id);

      if (admin.user_id) {
        await supabase.from("user_roles").update({ role: "user" }).eq("user_id", admin.user_id);
      }
      if (admin.seller_id) {
        await supabase.from("sellers").update({ role: "user" }).eq("id", admin.seller_id);
        await supabase.from("notifications_vendeur").insert({
          vendeur_id: admin.seller_id,
          vendeur_email: admin.email,
          titre: "👤 Rôle modifié",
          message: "Vous avez été rétrogradé au rôle de vendeur.",
          type: "alerte",
        });
      }

      toast({ title: "✅ Rétrogradé en vendeur" });
      onSuccess();
    } catch (error) {
      toast({ title: "❌ Erreur", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Supprimer définitivement ${admin.full_name} ? Cette action est irréversible.`)) return;
    setLoading(true);
    try {
      await supabase.from("admin_permissions").delete().eq("sous_admin_id", admin.id);
      await supabase.from("sous_admins").delete().eq("id", admin.id);

      if (admin.user_id) {
        await supabase.functions.invoke("delete-seller-complete", {
          body: { seller_id: admin.seller_id, user_id: admin.user_id },
        });
      }

      toast({ title: "✅ Sous-admin supprimé" });
      onSuccess();
    } catch (error) {
      toast({ title: "❌ Erreur", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            Gérer : {admin.full_name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Permissions */}
          <div>
            <p className="text-sm font-semibold text-slate-800 mb-2">🔑 Permissions modules</p>
            <div className="grid grid-cols-1 gap-1.5 bg-slate-50 rounded-lg p-3 max-h-52 overflow-y-auto">
              {ALL_MODULES.map(m => (
                <label key={m.id} className="flex items-center gap-2 cursor-pointer hover:bg-white p-1.5 rounded transition">
                  <Checkbox checked={permissions.includes(m.id)} onCheckedChange={() => togglePermission(m.id)} />
                  <span className="text-sm text-slate-700">{m.label}</span>
                </label>
              ))}
            </div>
            <Button onClick={handleUpdatePermissions} disabled={loading} className="w-full mt-2 bg-[#1a1f5e] hover:bg-[#141952]">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sauvegarder les permissions"}
            </Button>
          </div>

          {/* Actions */}
          <div className="border-t pt-4 space-y-2">
            <p className="text-sm font-semibold text-slate-800 mb-1">⚡ Actions</p>
            <Button variant="outline" className="w-full justify-start" onClick={handleToggleStatus} disabled={loading}>
              {admin.actif ? <><Pause className="w-4 h-4 mr-2" /> Suspendre le compte</> : <><Play className="w-4 h-4 mr-2" /> Réactiver le compte</>}
            </Button>
            <Button variant="outline" className="w-full justify-start text-orange-600 hover:text-orange-700 hover:bg-orange-50" onClick={handleDemote} disabled={loading}>
              <UserMinus className="w-4 h-4 mr-2" /> Rétrograder en vendeur
            </Button>
            <Button variant="outline" className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50" onClick={handleDelete} disabled={loading}>
              <Trash2 className="w-4 h-4 mr-2" /> Supprimer définitivement
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Promote Vendor Modal ───
function PromoteVendeurModal({ onClose, onSuccess }) {
  const { toast } = useToast();
  const [vendors, setVendors] = useState([]);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingVendors, setLoadingVendors] = useState(true);

  useEffect(() => {
    loadVendors();
  }, []);

  const loadVendors = async () => {
    try {
      const { data: existingAdmins } = await supabase.from("sous_admins").select("email");
      const adminEmails = (existingAdmins || []).map(a => a.email);

      const { data } = await supabase
        .from("sellers")
        .select("id, email, full_name, user_id, seller_status")
        .eq("seller_status", "active_seller")
        .order("full_name");

      // Filter out existing admins and the main admin
      const filtered = (data || []).filter(v => !adminEmails.includes(v.email) && v.email.toLowerCase() !== "tonykodjeu@gmail.com");
      setVendors(filtered);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingVendors(false);
    }
  };

  const filteredVendors = vendors.filter(v =>
    v.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    v.email?.toLowerCase().includes(search.toLowerCase())
  );

  const handlePromote = async () => {
    if (!selectedVendor || permissions.length === 0) {
      toast({ title: "⚠️ Sélectionnez un vendeur et au moins une permission", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      // 1. Create sous_admin record
      const { data: sousAdmin, error: saError } = await supabase
        .from("sous_admins")
        .insert({
          user_id: selectedVendor.user_id,
          seller_id: selectedVendor.id,
          email: selectedVendor.email,
          full_name: selectedVendor.full_name,
          actif: true,
        })
        .select()
        .single();

      if (saError) throw saError;

      // 2. Create permissions
      await supabase.from("admin_permissions").insert({
        sous_admin_id: sousAdmin.id,
        sous_admin_email: selectedVendor.email,
        modules_autorises: permissions,
      });

      // 3. Update role in user_roles
      if (selectedVendor.user_id) {
        const { data: existingRole } = await supabase
          .from("user_roles")
          .select("id")
          .eq("user_id", selectedVendor.user_id)
          .maybeSingle();

        if (existingRole) {
          await supabase.from("user_roles").update({ role: "sous_admin" }).eq("user_id", selectedVendor.user_id);
        } else {
          await supabase.from("user_roles").insert({ user_id: selectedVendor.user_id, role: "sous_admin" });
        }
      }

      // 4. Update seller role
      await supabase.from("sellers").update({ role: "sous_admin" }).eq("id", selectedVendor.id);

      // 5. Notify
      await supabase.from("notifications_vendeur").insert({
        vendeur_id: selectedVendor.id,
        vendeur_email: selectedVendor.email,
        titre: "🎉 Vous êtes Sous-Administrateur !",
        message: `Félicitations ! Modules accessibles : ${permissions.map(p => ALL_MODULES.find(m => m.id === p)?.label || p).join(", ")}. Reconnectez-vous pour accéder à votre espace admin.`,
        type: "succes",
      });

      toast({ title: "✅ Promu Sous-Admin !", description: `${selectedVendor.full_name} est maintenant sous-administrateur.` });
      onSuccess();
    } catch (error) {
      toast({ title: "❌ Erreur", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-primary" />
            Promouvoir un vendeur
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Rechercher un vendeur..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Vendor list */}
          <div className="max-h-40 overflow-y-auto border rounded-lg divide-y">
            {loadingVendors ? (
              <div className="p-4 text-center text-sm text-slate-400"><Loader2 className="w-4 h-4 animate-spin inline mr-2" />Chargement...</div>
            ) : filteredVendors.length === 0 ? (
              <div className="p-4 text-center text-sm text-slate-400">Aucun vendeur actif disponible</div>
            ) : (
              filteredVendors.map(v => (
                <div
                  key={v.id}
                  onClick={() => setSelectedVendor(v)}
                  className={`p-3 cursor-pointer transition-colors ${selectedVendor?.id === v.id ? "bg-amber-50 border-l-2 border-amber-400" : "hover:bg-slate-50"}`}
                >
                  <p className="text-sm font-medium text-slate-800">{v.full_name}</p>
                  <p className="text-xs text-slate-500">{v.email}</p>
                </div>
              ))
            )}
          </div>

          {/* Permissions */}
          {selectedVendor && (
            <div>
              <p className="text-sm font-semibold text-slate-800 mb-2">
                🔑 Permissions pour {selectedVendor.full_name}
              </p>
              <div className="grid grid-cols-1 gap-1.5 bg-slate-50 rounded-lg p-3 max-h-44 overflow-y-auto">
                {ALL_MODULES.map(m => (
                  <label key={m.id} className="flex items-center gap-2 cursor-pointer hover:bg-white p-1.5 rounded transition">
                    <Checkbox
                      checked={permissions.includes(m.id)}
                      onCheckedChange={() => setPermissions(prev => prev.includes(m.id) ? prev.filter(p => p !== m.id) : [...prev, m.id])}
                    />
                    <span className="text-sm text-slate-700">{m.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button
            onClick={handlePromote}
            disabled={loading || !selectedVendor || permissions.length === 0}
            className="bg-[#f5a623] hover:bg-[#e8940f] text-white"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <UserPlus className="w-4 h-4 mr-2" />}
            Promouvoir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ───
export default function GestionAdmins() {
  const [showPromoteModal, setShowPromoteModal] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState(null);
  const queryClient = useQueryClient();

  const { data: sousAdmins = [], isLoading } = useQuery({
    queryKey: ["sous_admins_with_perms"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sous_admins")
        .select("*, admin_permissions(modules_autorises)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["sous_admins_with_perms"] });
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <UserCog className="w-5 h-5" /> Gestion des Administrateurs
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Promouvez des vendeurs et gérez leurs accès.</p>
        </div>
        <Button onClick={() => setShowPromoteModal(true)} className="bg-[#f5a623] hover:bg-[#e8940f] text-white">
          <UserPlus className="w-4 h-4 mr-2" /> Promouvoir un vendeur
        </Button>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Chargement...
        </div>
      ) : sousAdmins.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <UserCog className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="font-medium text-slate-600 mb-1">Aucun sous-administrateur</p>
          <p className="text-sm text-slate-400">Promouvez un vendeur actif pour commencer.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <Badge variant="outline" className="text-xs">
            {sousAdmins.length} sous-admin{sousAdmins.length > 1 ? "s" : ""}
          </Badge>
          {sousAdmins.map(admin => (
            <AdminCard key={admin.id} admin={admin} onManage={setSelectedAdmin} />
          ))}
        </div>
      )}

      {/* Modals */}
      {showPromoteModal && (
        <PromoteVendeurModal
          onClose={() => setShowPromoteModal(false)}
          onSuccess={() => { setShowPromoteModal(false); refresh(); }}
        />
      )}

      {selectedAdmin && (
        <ManageAdminModal
          admin={selectedAdmin}
          onClose={() => setSelectedAdmin(null)}
          onSuccess={() => { setSelectedAdmin(null); refresh(); }}
        />
      )}
    </div>
  );
}
