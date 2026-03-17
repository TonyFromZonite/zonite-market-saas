import React, { useState, useEffect } from "react";
import { requireAdminOrSousAdmin } from "@/components/useSessionGuard";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Search, Pencil, Trash2, Package, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import CategoriesTab from "@/components/produits/CategoriesTab";
import RetoursTab from "@/components/produits/RetoursTab";
import DialogProduit from "@/components/produits/DialogProduit";
import { listTable, filterTable } from "@/lib/supabaseHelpers";
import { supabase } from "@/integrations/supabase/client";

const initProduit = {
  nom: "", description: "", reference: "",
  categorie_id: "",
  prix_achat: 0, prix_gros: 0, prix_vente: 0,
  seuil_alerte_stock: 5,
  images: [],
  variations: [],
  stocks_par_coursier: [],
  actif: true,
  lien_telegram: "",
};

const ONGLETS = [
  { key: "produits", label: "Produits" },
  { key: "categories", label: "Catégories" },
  { key: "retours", label: "Retours" },
];

export default function Produits() {
  useEffect(() => { requireAdminOrSousAdmin(); }, []);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [onglet, setOnglet] = useState("produits");
  const [recherche, setRecherche] = useState("");
  const [filtreCategorie, setFiltreCategorie] = useState("all");
  const [dialogOuvert, setDialogOuvert] = useState(false);
  const [produitEdite, setProduitEdite] = useState(null);
  const [form, setForm] = useState(initProduit);
  const [enCours, setEnCours] = useState(false);
  const [confirmSuppression, setConfirmSuppression] = useState(null);

  const { data: produits = [], isLoading } = useQuery({
    queryKey: ["produits"],
    queryFn: async () => {
      const { data } = await supabase.from("produits").select("*").order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: () => listTable("categories", "nom"),
  });

  const { data: retoursEnAttente = [] } = useQuery({
    queryKey: ["retours_badge"],
    queryFn: () => filterTable("retours_produit", { statut: "en_attente" }),
  });

  const ouvrir = (produit) => {
    if (produit) {
      setProduitEdite(produit);
      setForm({
        ...initProduit,
        ...produit,
        images: produit.images || [],
        variations: produit.variations || [],
        stocks_par_coursier: produit.stocks_par_coursier || [],
      });
    } else {
      setProduitEdite(null);
      setForm(initProduit);
    }
    setDialogOuvert(true);
  };

  const sauvegarder = async () => {
    if (!form.nom?.trim()) { toast({ title: "Erreur", description: "Nom requis", variant: "destructive" }); return; }

    setEnCours(true);
    try {
      const stockGlobal = (form.stocks_par_coursier || []).reduce((t, s) => t + (s.stock_total || 0), 0);
      const data = {
        nom: form.nom,
        description: form.description || null,
        reference: form.reference || null,
        categorie_id: form.categorie_id || null,
        prix_achat: parseFloat(form.prix_achat) || 0,
        prix_gros: parseFloat(form.prix_gros) || 0,
        prix_vente: parseFloat(form.prix_vente) || 0,
        seuil_alerte_stock: form.seuil_alerte_stock || 5,
        images: form.images || [],
        variations: form.variations || [],
        stocks_par_coursier: form.stocks_par_coursier || [],
        stock_global: stockGlobal,
        actif: form.actif !== false,
        lien_telegram: form.lien_telegram || null,
      };

      if (produitEdite) {
        const { error } = await supabase.from("produits").update(data).eq("id", produitEdite.id);
        if (error) throw error;
        toast({ title: "Succès", description: "Produit modifié" });
      } else {
        const { error } = await supabase.from("produits").insert(data);
        if (error) throw error;
        toast({ title: "Succès", description: "Produit créé" });
      }

      queryClient.invalidateQueries({ queryKey: ["produits"] });
      setDialogOuvert(false);
      setProduitEdite(null);
      setForm(initProduit);
    } catch (err) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setEnCours(false);
    }
  };

  const supprimer = async (produit) => {
    setEnCours(true);
    try {
      const { error } = await supabase.from("produits").delete().eq("id", produit.id);
      if (error) throw error;
      toast({ title: "Produit supprimé" });
      queryClient.invalidateQueries({ queryKey: ["produits"] });
      setConfirmSuppression(null);
    } catch (err) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setEnCours(false);
    }
  };

  const produitsFiltres = produits.filter((p) => {
    const matchRecherche = `${p.nom} ${p.reference || ""}`.toLowerCase().includes(recherche.toLowerCase());
    const matchCat = filtreCategorie === "all" || p.categorie_id === filtreCategorie;
    return matchRecherche && matchCat;
  });

  const formater = (n) => `${Math.round(n || 0).toLocaleString("fr-FR")} FCFA`;

  if (isLoading) return <div className="space-y-3">{Array(6).fill(0).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>;

  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b border-slate-200 overflow-x-auto">
        {ONGLETS.map(({ key, label }) => {
          const badge = key === "retours" ? retoursEnAttente.length : 0;
          return (
            <button key={key} onClick={() => setOnglet(key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${onglet === key ? "border-[#1a1f5e] text-[#1a1f5e]" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
              {label}
              {badge > 0 && <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{badge}</span>}
            </button>
          );
        })}
      </div>

      {onglet === "categories" && <CategoriesTab />}
      {onglet === "retours" && <RetoursTab />}
      {onglet === "produits" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 justify-between">
            <div className="flex flex-1 gap-2 max-w-2xl">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input placeholder="Rechercher..." value={recherche} onChange={(e) => setRecherche(e.target.value)} className="pl-9" />
              </div>
              <Select value={filtreCategorie} onValueChange={setFiltreCategorie}>
                <SelectTrigger className="w-48"><SelectValue placeholder="Toutes catégories" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes catégories</SelectItem>
                  {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => ouvrir(null)} className="bg-[#1a1f5e] hover:bg-[#141952]">
              <Plus className="w-4 h-4 mr-2" /> Nouveau Produit
            </Button>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>Produit</TableHead>
                    <TableHead>Réf</TableHead>
                    <TableHead className="text-right">Prix Achat</TableHead>
                    <TableHead className="text-right">Prix Gros</TableHead>
                    <TableHead className="text-center">Stock</TableHead>
                    <TableHead className="text-center">Variations</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="w-24">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {produitsFiltres.length === 0 && (
                    <TableRow><TableCell colSpan={8} className="text-center py-8 text-slate-400">Aucun produit</TableCell></TableRow>
                  )}
                  {produitsFiltres.map((p) => {
                    const stockGlobal = p.stock_global || 0;
                    const enAlerte = stockGlobal <= (p.seuil_alerte_stock || 5);
                    const nbVar = (p.variations || []).reduce((t, v) => t + (v.options?.length || 0), 0);
                    return (
                      <TableRow key={p.id} className="hover:bg-slate-50">
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {(p.images?.[0]) ? (
                              <img src={p.images[0]} alt={p.nom} className="w-8 h-8 rounded object-cover flex-shrink-0" />
                            ) : (
                              <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center flex-shrink-0">
                                <Package className="w-4 h-4 text-slate-400" />
                              </div>
                            )}
                            <span className="font-medium">{p.nom}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-slate-500">{p.reference || "—"}</TableCell>
                        <TableCell className="text-right text-sm">{formater(p.prix_achat)}</TableCell>
                        <TableCell className="text-right text-sm">{formater(p.prix_gros)}</TableCell>
                        <TableCell className="text-center">
                          <span className={`px-2 py-1 rounded text-sm font-medium ${enAlerte ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}>
                            {stockGlobal}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          {nbVar > 0 ? <Badge className="bg-purple-100 text-purple-700 text-xs">{nbVar}</Badge> : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge className={`text-xs ${p.actif ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                            {p.actif ? "Actif" : "Inactif"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => ouvrir(p)}><Pencil className="w-4 h-4 text-slate-500" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => setConfirmSuppression(p)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>

          <DialogProduit
            open={dialogOuvert}
            onOpenChange={setDialogOuvert}
            produit={produitEdite}
            form={form}
            setForm={setForm}
            categories={categories}
            onSave={sauvegarder}
            enCours={enCours}
          />

          <Dialog open={!!confirmSuppression} onOpenChange={() => setConfirmSuppression(null)}>
            <DialogContent className="max-w-sm">
              <DialogHeader><DialogTitle>Supprimer le produit</DialogTitle></DialogHeader>
              <p className="text-sm text-slate-600">Supprimer <strong>"{confirmSuppression?.nom}"</strong> ? Action irréversible.</p>
              <DialogFooter>
                <Button variant="outline" onClick={() => setConfirmSuppression(null)}>Annuler</Button>
                <Button variant="destructive" onClick={() => supprimer(confirmSuppression)} disabled={enCours}>
                  {enCours ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}Supprimer
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}
    </div>
  );
}
