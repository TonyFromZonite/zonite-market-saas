import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Truck, Plus, Edit2, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const initForm = { nom: "", telephone: "", email: "", ville_id: "", adresse_entrepot: "", zones_livraison_ids: [], frais_livraison_defaut: 0 };

export default function GestionCoursiers() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOuvert, setDialogOuvert] = useState(false);
  const [coursierEdit, setCoursierEdit] = useState(null);
  const [form, setForm] = useState(initForm);

  const { data: villes = [] } = useQuery({
    queryKey: ["villes_cameroun"],
    queryFn: async () => {
      const { data } = await supabase.from("villes_cameroun").select("*").eq("actif", true).order("nom");
      return data || [];
    },
  });

  const { data: zonesLivraison = [] } = useQuery({
    queryKey: ["zones_livraison"],
    queryFn: async () => {
      const { data } = await supabase.from("zones_livraison").select("*").eq("actif", true).order("nom");
      return data || [];
    },
  });

  const { data: coursiers = [] } = useQuery({
    queryKey: ["coursiers"],
    queryFn: async () => {
      const { data } = await supabase.from("coursiers").select("*").order("created_at", { ascending: false });
      return data || [];
    },
  });

  const createMut = useMutation({
    mutationFn: async (data) => {
      const { error } = await supabase.from("coursiers").insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coursiers"] });
      setDialogOuvert(false);
      toast({ title: "Succès", description: "Coursier créé" });
    },
    onError: (err) => toast({ title: "Erreur", description: err.message, variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, data }) => {
      const { error } = await supabase.from("coursiers").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coursiers"] });
      setDialogOuvert(false);
      toast({ title: "Succès", description: "Coursier mis à jour" });
    },
    onError: (err) => toast({ title: "Erreur", description: err.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id) => {
      // Clean FK references before deleting
      await supabase.from("commandes_vendeur").update({ coursier_id: null, coursier_nom: null }).eq("coursier_id", id);
      await supabase.from("mouvements_stock").update({ coursier_id: null }).eq("coursier_id", id);
      // Clean stocks_par_coursier JSONB in produits
      const { data: produits } = await supabase.from("produits").select("id, stocks_par_coursier").not("stocks_par_coursier", "is", null);
      for (const p of (produits || [])) {
        const filtered = (p.stocks_par_coursier || []).filter(s => s.coursier_id !== id);
        if (filtered.length !== (p.stocks_par_coursier || []).length) {
          await supabase.from("produits").update({ stocks_par_coursier: filtered }).eq("id", p.id);
        }
      }
      const { error } = await supabase.from("coursiers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coursiers"] });
      toast({ title: "✅ Coursier supprimé", description: "Suppression effectuée avec succès." });
    },
    onError: (err) => toast({ title: "❌ Erreur suppression", description: err.message, variant: "destructive" }),
  });

  const toggleMut = useMutation({
    mutationFn: async ({ id, actif }) => {
      const { error } = await supabase.from("coursiers").update({ actif }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["coursiers"] }),
  });

  const ouvrirDialog = (coursier = null) => {
    if (coursier) {
      setCoursierEdit(coursier);
      setForm({
        nom: coursier.nom || "",
        telephone: coursier.telephone || "",
        email: coursier.email || "",
        ville_id: coursier.ville_id || "",
        adresse_entrepot: coursier.adresse_entrepot || "",
        zones_livraison_ids: coursier.zones_livraison_ids || [],
        frais_livraison_defaut: coursier.frais_livraison_defaut || 0,
      });
    } else {
      setCoursierEdit(null);
      setForm(initForm);
    }
    setDialogOuvert(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.nom.trim()) return;
    const data = { ...form, frais_livraison_defaut: parseFloat(form.frais_livraison_defaut) || 0 };
    if (coursierEdit) {
      updateMut.mutate({ id: coursierEdit.id, data });
    } else {
      createMut.mutate(data);
    }
  };

  const toggleZone = (zoneId) => {
    setForm((f) => ({
      ...f,
      zones_livraison_ids: f.zones_livraison_ids.includes(zoneId)
        ? f.zones_livraison_ids.filter((id) => id !== zoneId)
        : [...f.zones_livraison_ids, zoneId],
    }));
  };

  const getVilleName = (id) => villes.find((v) => v.id === id)?.nom || "—";
  const getZoneNames = (ids) => zonesLivraison.filter((z) => (ids || []).includes(z.id)).map((z) => z.nom);
  const zonesForVille = form.ville_id ? zonesLivraison.filter((z) => z.ville_id === form.ville_id) : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Truck className="w-7 h-7 text-[#1a1f5e]" />
            Gestion des Coursiers
          </h1>
          <p className="text-sm text-slate-500 mt-1">Sociétés de livraison et entrepôts au Cameroun</p>
        </div>
        <Button onClick={() => ouvrirDialog()} className="bg-[#1a1f5e] hover:bg-[#141952]">
          <Plus className="w-4 h-4 mr-2" /> Nouveau Coursier
        </Button>
      </div>

      {/* List */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {coursiers.map((c) => {
          const zoneNames = getZoneNames(c.zones_livraison_ids);
          return (
            <Card key={c.id} className="p-4 hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="font-bold text-slate-900">{c.nom}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant={c.actif ? "default" : "secondary"}>{c.actif ? "Actif" : "Inactif"}</Badge>
                    <span className="text-xs text-slate-500">{getVilleName(c.ville_id)}</span>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => toggleMut.mutate({ id: c.id, actif: !c.actif })}>
                    <div className={`w-3 h-3 rounded-full ${c.actif ? "bg-emerald-500" : "bg-slate-300"}`} />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => ouvrirDialog(c)}><Edit2 className="w-4 h-4" /></Button>
                  <Button size="icon" variant="ghost" className="text-red-600" onClick={() => {
                    if (confirm("Supprimer ce coursier ?")) deleteMut.mutate(c.id);
                  }}><Trash2 className="w-4 h-4" /></Button>
                </div>
              </div>
              <div className="space-y-1 text-sm text-slate-600">
                {c.telephone && <p>📞 {c.telephone}</p>}
                {c.adresse_entrepot && <p>📦 {c.adresse_entrepot}</p>}
                <p className="text-xs">Frais défaut: {(c.frais_livraison_defaut || 0).toLocaleString()} FCFA</p>
              </div>
              {zoneNames.length > 0 && (
                <div className="mt-3 pt-3 border-t">
                  <p className="text-xs text-slate-500 mb-1">Zones couvertes:</p>
                  <div className="flex flex-wrap gap-1">
                    {zoneNames.map((n, i) => <Badge key={i} variant="outline" className="text-xs">{n}</Badge>)}
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {coursiers.length === 0 && <p className="text-center text-slate-400 py-8">Aucun coursier créé.</p>}

      {/* Dialog */}
      <Dialog open={dialogOuvert} onOpenChange={setDialogOuvert}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{coursierEdit ? "Modifier le Coursier" : "Nouveau Coursier"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Nom de la société *</Label>
              <Input value={form.nom} onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))} placeholder="Ex: Yango Livraison Yaoundé" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Téléphone</Label>
                <Input value={form.telephone} onChange={(e) => setForm((f) => ({ ...f, telephone: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Ville de l'entrepôt *</Label>
              <Select value={form.ville_id} onValueChange={(v) => setForm((f) => ({ ...f, ville_id: v, zones_livraison_ids: [] }))}>
                <SelectTrigger><SelectValue placeholder="Choisir une ville" /></SelectTrigger>
                <SelectContent>
                  {villes.map((v) => <SelectItem key={v.id} value={v.id}>{v.nom}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Adresse de l'entrepôt</Label>
              <Input value={form.adresse_entrepot} onChange={(e) => setForm((f) => ({ ...f, adresse_entrepot: e.target.value }))} />
            </div>
            {form.ville_id && (
              <div className="space-y-2">
                <Label>Zones de livraison couvertes</Label>
                <div className="border rounded-lg p-3 max-h-40 overflow-y-auto space-y-2">
                  {zonesForVille.length === 0 ? (
                    <p className="text-xs text-slate-400">Aucune zone pour cette ville. Créez-en dans Gestion Zones.</p>
                  ) : (
                    zonesForVille.map((z) => (
                      <div key={z.id} className="flex items-center gap-2">
                        <Checkbox checked={form.zones_livraison_ids.includes(z.id)} onCheckedChange={() => toggleZone(z.id)} />
                        <span className="text-sm">{z.nom}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label>Frais de livraison par défaut (FCFA)</Label>
              <Input type="number" min="0" value={form.frais_livraison_defaut}
                onChange={(e) => setForm((f) => ({ ...f, frais_livraison_defaut: e.target.value }))} />
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOuvert(false)} className="flex-1">Annuler</Button>
              <Button type="submit" className="flex-1 bg-[#1a1f5e] hover:bg-[#141952]"
                disabled={createMut.isPending || updateMut.isPending}>
                {coursierEdit ? "Mettre à jour" : "Créer"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
