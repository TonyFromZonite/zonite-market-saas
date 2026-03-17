import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { MapPin, Plus, Edit2, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export default function GestionZones() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogZone, setDialogZone] = useState(false);
  const [dialogQuartier, setDialogQuartier] = useState(false);
  const [zoneEdit, setZoneEdit] = useState(null);
  const [villeFiltre, setVilleFiltre] = useState("all");
  const [expandedVille, setExpandedVille] = useState(null);
  const [formZone, setFormZone] = useState({ nom: "", ville_id: "", quartiers_ids: [] });
  const [formQuartier, setFormQuartier] = useState({ nom: "", ville_id: "" });

  // Queries
  const { data: villes = [] } = useQuery({
    queryKey: ["villes_cameroun"],
    queryFn: async () => {
      const { data } = await supabase.from("villes_cameroun").select("*").eq("actif", true).order("nom");
      return data || [];
    },
  });

  const { data: quartiers = [] } = useQuery({
    queryKey: ["quartiers"],
    queryFn: async () => {
      const { data } = await supabase.from("quartiers").select("*").eq("actif", true).order("nom");
      return data || [];
    },
  });

  const { data: zones = [], isLoading } = useQuery({
    queryKey: ["zones_livraison"],
    queryFn: async () => {
      const { data } = await supabase.from("zones_livraison").select("*").order("created_at", { ascending: false });
      return data || [];
    },
  });

  // Mutations
  const createZoneMut = useMutation({
    mutationFn: async (data) => {
      const { error } = await supabase.from("zones_livraison").insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["zones_livraison"] });
      setDialogZone(false);
      toast({ title: "Succès", description: "Zone créée avec succès" });
    },
    onError: (err) => toast({ title: "Erreur", description: err.message, variant: "destructive" }),
  });

  const updateZoneMut = useMutation({
    mutationFn: async ({ id, data }) => {
      const { error } = await supabase.from("zones_livraison").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["zones_livraison"] });
      setDialogZone(false);
      toast({ title: "Succès", description: "Zone mise à jour" });
    },
    onError: (err) => toast({ title: "Erreur", description: err.message, variant: "destructive" }),
  });

  const deleteZoneMut = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from("zones_livraison").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["zones_livraison"] });
      toast({ title: "Zone supprimée" });
    },
    onError: (err) => toast({ title: "Erreur", description: err.message, variant: "destructive" }),
  });

  const toggleZoneMut = useMutation({
    mutationFn: async ({ id, actif }) => {
      const { error } = await supabase.from("zones_livraison").update({ actif }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["zones_livraison"] }),
  });

  const [keepQuartierOpen, setKeepQuartierOpen] = useState(false);

  const createQuartierMut = useMutation({
    mutationFn: async (data) => {
      const { error } = await supabase.from("quartiers").insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quartiers"] });
      toast({ title: "✓ Quartier ajouté", description: `"${formQuartier.nom}" a été créé avec succès` });
      if (keepQuartierOpen) {
        setFormQuartier((f) => ({ ...f, nom: "" }));
      } else {
        setDialogQuartier(false);
        setFormQuartier({ nom: "", ville_id: "" });
      }
    },
    onError: (err) => toast({ title: "Erreur", description: err.message, variant: "destructive" }),
  });

  const deleteQuartierMut = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from("quartiers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quartiers"] });
      toast({ title: "Quartier supprimé" });
    },
  });

  // Handlers
  const ouvrirDialogZone = (zone = null) => {
    if (zone) {
      setZoneEdit(zone);
      setFormZone({ nom: zone.nom, ville_id: zone.ville_id, quartiers_ids: zone.quartiers_ids || [] });
    } else {
      setZoneEdit(null);
      setFormZone({ nom: "", ville_id: "", quartiers_ids: [] });
    }
    setDialogZone(true);
  };

  const handleSubmitZone = (e) => {
    e.preventDefault();
    if (!formZone.nom.trim() || !formZone.ville_id) return;
    const data = { nom: formZone.nom, ville_id: formZone.ville_id, quartiers_ids: formZone.quartiers_ids };
    if (zoneEdit) {
      updateZoneMut.mutate({ id: zoneEdit.id, data });
    } else {
      createZoneMut.mutate(data);
    }
  };

  const toggleQuartier = (qId) => {
    setFormZone((f) => ({
      ...f,
      quartiers_ids: f.quartiers_ids.includes(qId) ? f.quartiers_ids.filter((id) => id !== qId) : [...f.quartiers_ids, qId],
    }));
  };

  const getVilleName = (villeId) => villes.find((v) => v.id === villeId)?.nom || "—";
  const getQuartiersForVille = (villeId) => quartiers.filter((q) => q.ville_id === villeId);
  const getQuartierNames = (ids) => quartiers.filter((q) => (ids || []).includes(q.id)).map((q) => q.nom);

  // Group zones by ville
  const zonesParVille = {};
  zones.forEach((z) => {
    const ville = getVilleName(z.ville_id);
    if (!zonesParVille[ville]) zonesParVille[ville] = [];
    zonesParVille[ville].push(z);
  });

  const filteredVilles = villeFiltre === "all" ? Object.keys(zonesParVille).sort() : [villeFiltre].filter((v) => zonesParVille[v]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <MapPin className="w-7 h-7 text-[#1a1f5e]" />
            Zones de Livraison & Quartiers
          </h1>
          <p className="text-sm text-slate-500 mt-1">Gérer les zones par ville et leurs quartiers</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setDialogQuartier(true)}>
            <Plus className="w-4 h-4 mr-1" /> Quartier
          </Button>
          <Button onClick={() => ouvrirDialogZone()} className="bg-[#1a1f5e] hover:bg-[#141952]">
            <Plus className="w-4 h-4 mr-2" /> Nouvelle Zone
          </Button>
        </div>
      </div>

      {/* Filtre par ville */}
      <div className="flex gap-3 items-center">
        <Label className="text-sm">Filtrer par ville :</Label>
        <Select value={villeFiltre} onValueChange={setVilleFiltre}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les villes</SelectItem>
            {villes.map((v) => <SelectItem key={v.id} value={v.nom}>{v.nom}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Zones grouped by ville */}
      {filteredVilles.length === 0 && (
        <p className="text-center text-slate-400 py-8">Aucune zone de livraison créée.</p>
      )}

      {filteredVilles.map((ville) => (
        <Card key={ville} className="overflow-hidden">
          <button
            onClick={() => setExpandedVille(expandedVille === ville ? null : ville)}
            className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-[#1a1f5e]" />
              <span className="font-bold text-slate-900">{ville}</span>
              <Badge variant="secondary">{zonesParVille[ville].length} zone{zonesParVille[ville].length > 1 ? "s" : ""}</Badge>
            </div>
            {expandedVille === ville ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {(expandedVille === ville || expandedVille === null) && (
            <div className="border-t divide-y">
              {zonesParVille[ville].map((zone) => {
                const qNames = getQuartierNames(zone.quartiers_ids);
                return (
                  <div key={zone.id} className="p-4 flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-slate-800">{zone.nom}</span>
                        <Badge variant={zone.actif ? "default" : "secondary"} className="text-xs">
                          {zone.actif ? "Actif" : "Inactif"}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {qNames.length > 0 ? qNames.map((n, i) => (
                          <Badge key={i} variant="outline" className="text-xs">{n}</Badge>
                        )) : <span className="text-xs text-slate-400">Aucun quartier</span>}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => toggleZoneMut.mutate({ id: zone.id, actif: !zone.actif })}>
                        <div className={`w-3 h-3 rounded-full ${zone.actif ? "bg-emerald-500" : "bg-slate-300"}`} />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => ouvrirDialogZone(zone)}>
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="text-red-600" onClick={() => {
                        if (confirm("Supprimer cette zone ?")) deleteZoneMut.mutate(zone.id);
                      }}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      ))}

      {/* Quartiers management section */}
      <div className="mt-8">
        <h2 className="text-lg font-bold text-slate-900 mb-3">Gestion des Quartiers</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {villes.map((ville) => {
            const qs = getQuartiersForVille(ville.id);
            return (
              <Card key={ville.id} className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-slate-800">{ville.nom} <span className="text-slate-400 text-sm">({qs.length})</span></h3>
                  <Button size="sm" variant="ghost" className="h-7 text-xs text-primary"
                    onClick={() => { setFormQuartier({ nom: "", ville_id: ville.id }); setKeepQuartierOpen(true); setDialogQuartier(true); }}>
                    <Plus className="w-3 h-3 mr-1" /> Ajouter
                  </Button>
                </div>
                {qs.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">Aucun quartier — cliquez "Ajouter" ci-dessus</p>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {qs.map((q) => (
                      <Badge key={q.id} variant="outline" className="text-xs flex items-center gap-1">
                        {q.nom}
                        <button onClick={() => { if (confirm(`Supprimer "${q.nom}" ?`)) deleteQuartierMut.mutate(q.id); }}
                          className="ml-1 text-red-400 hover:text-red-600">×</button>
                      </Badge>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </div>

      {/* Dialog Zone */}
      <Dialog open={dialogZone} onOpenChange={setDialogZone}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{zoneEdit ? "Modifier la Zone" : "Nouvelle Zone"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmitZone} className="space-y-4">
            <div className="space-y-2">
              <Label>Ville *</Label>
              <Select value={formZone.ville_id} onValueChange={(v) => setFormZone((f) => ({ ...f, ville_id: v, quartiers_ids: [] }))}>
                <SelectTrigger><SelectValue placeholder="Choisir une ville" /></SelectTrigger>
                <SelectContent>
                  {villes.map((v) => <SelectItem key={v.id} value={v.id}>{v.nom}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Nom de la zone *</Label>
              <Input value={formZone.nom} onChange={(e) => setFormZone((f) => ({ ...f, nom: e.target.value }))} placeholder="Ex: Zone Centre" required />
            </div>
            {formZone.ville_id && (
              <div className="space-y-2">
                <Label>Quartiers couverts</Label>
                <div className="border rounded-lg p-3 max-h-48 overflow-y-auto space-y-2">
                  {getQuartiersForVille(formZone.ville_id).length === 0 ? (
                    <p className="text-xs text-slate-400">Aucun quartier pour cette ville. Ajoutez-en d'abord.</p>
                  ) : (
                    getQuartiersForVille(formZone.ville_id).map((q) => (
                      <div key={q.id} className="flex items-center gap-2">
                        <Checkbox
                          checked={formZone.quartiers_ids.includes(q.id)}
                          onCheckedChange={() => toggleQuartier(q.id)}
                        />
                        <span className="text-sm">{q.nom}</span>
                      </div>
                    ))
                  )}
                </div>
                <Button type="button" variant="link" size="sm" className="text-xs p-0 h-auto"
                  onClick={() => { setFormQuartier({ nom: "", ville_id: formZone.ville_id }); setDialogQuartier(true); }}>
                  + Ajouter un quartier à cette ville
                </Button>
              </div>
            )}
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogZone(false)} className="flex-1">Annuler</Button>
              <Button type="submit" className="flex-1 bg-[#1a1f5e] hover:bg-[#141952]"
                disabled={createZoneMut.isPending || updateZoneMut.isPending}>
                {zoneEdit ? "Mettre à jour" : "Créer"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog Quartier */}
      <Dialog open={dialogQuartier} onOpenChange={(open) => { setDialogQuartier(open); if (!open) setKeepQuartierOpen(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Nouveau Quartier</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); if (formQuartier.nom.trim() && formQuartier.ville_id) createQuartierMut.mutate(formQuartier); }} className="space-y-4">
            <div className="space-y-2">
              <Label>Ville *</Label>
              <Select value={formQuartier.ville_id} onValueChange={(v) => setFormQuartier((f) => ({ ...f, ville_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Choisir une ville" /></SelectTrigger>
                <SelectContent>
                  {villes.map((v) => <SelectItem key={v.id} value={v.id}>{v.nom}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Nom du quartier *</Label>
              <Input value={formQuartier.nom} onChange={(e) => setFormQuartier((f) => ({ ...f, nom: e.target.value }))} placeholder="Ex: Bastos" required autoFocus />
            </div>
            {/* Show existing quartiers for selected ville */}
            {formQuartier.ville_id && getQuartiersForVille(formQuartier.ville_id).length > 0 && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Quartiers existants :</Label>
                <div className="flex flex-wrap gap-1">
                  {getQuartiersForVille(formQuartier.ville_id).map((q) => (
                    <Badge key={q.id} variant="secondary" className="text-xs">{q.nom}</Badge>
                  ))}
                </div>
              </div>
            )}
            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={() => { setDialogQuartier(false); setKeepQuartierOpen(false); }} className="flex-1">Fermer</Button>
              <Button type="submit" className="flex-1 bg-[#1a1f5e] hover:bg-[#141952]" disabled={createQuartierMut.isPending}>
                {createQuartierMut.isPending ? "Ajout..." : "Ajouter"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
