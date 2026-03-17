import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { uploadFile } from "@/lib/supabaseHelpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, ImagePlus, X, Plus, Trash2, Layers, Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

export default function DialogProduit({ open, onOpenChange, produit, form, setForm, categories, onSave, enCours }) {
  const [urlImageAjout, setUrlImageAjout] = useState("");
  const [uploadEnCours, setUploadEnCours] = useState(false);
  const [newVarName, setNewVarName] = useState("");
  const [newVarOptions, setNewVarOptions] = useState("");
  const [showVarModal, setShowVarModal] = useState(false);
  const [showStockModal, setShowStockModal] = useState(false);
  const [stockForm, setStockForm] = useState({ coursier_id: "", stock_par_variation: [] });

  // Load coursiers
  const { data: coursiers = [] } = useQuery({
    queryKey: ["coursiers"],
    queryFn: async () => {
      const { data } = await supabase.from("coursiers").select("*").eq("actif", true).order("nom");
      return data || [];
    },
  });

  const { data: villes = [] } = useQuery({
    queryKey: ["villes_cameroun"],
    queryFn: async () => {
      const { data } = await supabase.from("villes_cameroun").select("*").eq("actif", true).order("nom");
      return data || [];
    },
  });

  const modifier = (champ, valeur) => setForm((p) => ({ ...p, [champ]: valeur }));

  const modifierCategorie = (id) => {
    const cat = categories.find((c) => c.id === id);
    setForm((p) => ({ ...p, categorie_id: id, categorie_nom: cat?.nom || "" }));
  };

  // Images
  const uploadImage = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadEnCours(true);
    try {
      const { file_url } = await uploadFile(file);
      const imgs = [...(form.images || []), file_url];
      setForm((p) => ({ ...p, images: imgs }));
    } finally {
      setUploadEnCours(false);
    }
  };

  const ajouterImageUrl = () => {
    if (!urlImageAjout.trim()) return;
    const imgs = [...(form.images || []), urlImageAjout.trim()];
    setForm((p) => ({ ...p, images: imgs }));
    setUrlImageAjout("");
  };

  const supprimerImage = (idx) => {
    const imgs = (form.images || []).filter((_, i) => i !== idx);
    setForm((p) => ({ ...p, images: imgs }));
  };

  // Variations — new structure: [{id, nom, options: []}]
  const variations = form.variations || [];

  const ajouterVariation = () => {
    if (!newVarName.trim() || !newVarOptions.trim()) return;
    const opts = newVarOptions.split(",").map((o) => o.trim()).filter(Boolean);
    const newVar = { id: crypto.randomUUID(), nom: newVarName.trim(), options: opts };
    setForm((p) => ({ ...p, variations: [...(p.variations || []), newVar] }));
    setNewVarName("");
    setNewVarOptions("");
    setShowVarModal(false);
  };

  const supprimerVariation = (varId) => {
    setForm((p) => ({
      ...p,
      variations: (p.variations || []).filter((v) => v.id !== varId),
      // Also clean stock references
      stocks_par_coursier: (p.stocks_par_coursier || []).map((sc) => ({
        ...sc,
        stock_par_variation: (sc.stock_par_variation || []).filter(
          (sv) => !sv.variation_key.startsWith((p.variations || []).find((v) => v.id === varId)?.nom + ":")
        ),
      })),
    }));
  };

  // Generate all variation keys from defined variations
  const getVariationKeys = () => {
    if (variations.length === 0) return [];
    // For single variation type, keys are "NomType:Option"
    // For multiple, we do cartesian product
    if (variations.length === 1) {
      return variations[0].options.map((opt) => `${variations[0].nom}:${opt}`);
    }
    // Cartesian product for multiple variation types
    let keys = variations[0].options.map((o) => `${variations[0].nom}:${o}`);
    for (let i = 1; i < variations.length; i++) {
      const newKeys = [];
      for (const key of keys) {
        for (const opt of variations[i].options) {
          newKeys.push(`${key} / ${variations[i].nom}:${opt}`);
        }
      }
      keys = newKeys;
    }
    return keys;
  };

  const variationKeys = getVariationKeys();

  // Stock par coursier
  const stocksParCoursier = form.stocks_par_coursier || [];

  const ouvrirStockModal = () => {
    setStockForm({
      coursier_id: "",
      stock_par_variation: variationKeys.map((k) => ({ variation_key: k, quantite: 0 })),
    });
    setShowStockModal(true);
  };

  const ajouterStockCoursier = () => {
    if (!stockForm.coursier_id) return;
    const coursier = coursiers.find((c) => c.id === stockForm.coursier_id);
    const ville = villes.find((v) => v.id === coursier?.ville_id);
    const stockTotal = stockForm.stock_par_variation.reduce((s, v) => s + (parseInt(v.quantite) || 0), 0);
    const newEntry = {
      coursier_id: stockForm.coursier_id,
      coursier_nom: coursier?.nom || "",
      ville: ville?.nom || "",
      stock_total: stockTotal,
      stock_par_variation: stockForm.stock_par_variation,
    };
    // Replace if already exists for this coursier
    const existing = stocksParCoursier.filter((s) => s.coursier_id !== stockForm.coursier_id);
    setForm((p) => ({ ...p, stocks_par_coursier: [...existing, newEntry] }));
    setShowStockModal(false);
  };

  const supprimerStockCoursier = (coursierId) => {
    setForm((p) => ({ ...p, stocks_par_coursier: (p.stocks_par_coursier || []).filter((s) => s.coursier_id !== coursierId) }));
  };

  const editStockCoursier = (entry) => {
    // Fill missing variation keys
    const existingKeys = (entry.stock_par_variation || []).map((v) => v.variation_key);
    const merged = variationKeys.map((k) => {
      const existing = entry.stock_par_variation?.find((v) => v.variation_key === k);
      return existing || { variation_key: k, quantite: 0 };
    });
    setStockForm({ coursier_id: entry.coursier_id, stock_par_variation: merged });
    setShowStockModal(true);
  };

  // Calculate global stock
  const stockGlobal = stocksParCoursier.reduce((t, s) => t + (s.stock_total || 0), 0);

  const formater = (n) => `${Math.round(n || 0).toLocaleString("fr-FR")} FCFA`;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{produit ? "Modifier le Produit" : "Nouveau Produit"}</DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="infos" className="w-full">
            <TabsList className="grid w-full grid-cols-4 mb-4">
              <TabsTrigger value="infos">Infos</TabsTrigger>
              <TabsTrigger value="images">Images</TabsTrigger>
              <TabsTrigger value="variations">Variations</TabsTrigger>
              <TabsTrigger value="stock">Stock / Coursiers</TabsTrigger>
            </TabsList>

            {/* TAB INFOS */}
            <TabsContent value="infos" className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-2"><Label>Nom *</Label><Input value={form.nom} onChange={(e) => modifier("nom", e.target.value)} /></div>
                <div className="space-y-2"><Label>Référence</Label><Input value={form.reference} onChange={(e) => modifier("reference", e.target.value)} /></div>
                <div className="space-y-2">
                  <Label>Catégorie</Label>
                  <Select value={form.categorie_id} onValueChange={modifierCategorie}>
                    <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                    <SelectContent>{categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 space-y-2"><Label>Description</Label><Input value={form.description} onChange={(e) => modifier("description", e.target.value)} /></div>
              </div>

              <div>
                <p className="text-sm font-semibold text-slate-700 mb-3 border-b pb-1">Tarification</p>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Prix d'Achat (FCFA) *</Label>
                    <Input type="number" min="0" value={form.prix_achat}
                      onFocus={(e) => { if (e.target.value === "0") e.target.value = ""; }}
                      onChange={(e) => modifier("prix_achat", e.target.value === "" ? "" : parseFloat(e.target.value))}
                      onBlur={(e) => modifier("prix_achat", parseFloat(e.target.value) || 0)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Prix de Gros (FCFA)</Label>
                    <Input type="number" min="0" value={form.prix_gros}
                      onFocus={(e) => { if (e.target.value === "0") e.target.value = ""; }}
                      onChange={(e) => modifier("prix_gros", e.target.value === "" ? "" : parseFloat(e.target.value))}
                      onBlur={(e) => modifier("prix_gros", parseFloat(e.target.value) || 0)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Prix Vente (FCFA)</Label>
                    <Input type="number" min="0" value={form.prix_vente}
                      onFocus={(e) => { if (e.target.value === "0") e.target.value = ""; }}
                      onChange={(e) => modifier("prix_vente", e.target.value === "" ? "" : parseFloat(e.target.value))}
                      onBlur={(e) => modifier("prix_vente", parseFloat(e.target.value) || 0)} />
                  </div>
                </div>
                {(parseFloat(form.prix_gros) > 0 && parseFloat(form.prix_achat) > 0) && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm mt-3">
                    <p className="text-slate-500">Bénéfice ZONITE</p>
                    <p className="font-bold text-emerald-700">{formater((parseFloat(form.prix_gros) || 0) - (parseFloat(form.prix_achat) || 0))}</p>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Seuil Alerte Stock</Label>
                <Input type="number" min="0" value={form.seuil_alerte_stock || 5}
                  onChange={(e) => modifier("seuil_alerte_stock", parseInt(e.target.value) || 5)} />
              </div>
              <div className="space-y-2">
                <Label>Lien Telegram</Label>
                <Input value={form.lien_telegram} onChange={(e) => modifier("lien_telegram", e.target.value)} placeholder="https://t.me/..." />
              </div>
            </TabsContent>

            {/* TAB IMAGES */}
            <TabsContent value="images" className="space-y-4">
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {(form.images || []).map((url, idx) => (
                  <div key={idx} className="relative group rounded-lg overflow-hidden border border-slate-200 aspect-square">
                    <img src={url} alt={`Image ${idx + 1}`} className="w-full h-full object-cover" />
                    {idx === 0 && <span className="absolute top-1 left-1 text-[10px] bg-[#1a1f5e] text-white rounded px-1">Principale</span>}
                    <button onClick={() => supprimerImage(idx)} className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                <label className="border-2 border-dashed border-slate-300 rounded-lg aspect-square flex flex-col items-center justify-center cursor-pointer hover:border-[#1a1f5e] hover:bg-slate-50">
                  {uploadEnCours ? <Loader2 className="w-6 h-6 animate-spin text-slate-400" /> : <><ImagePlus className="w-6 h-6 text-slate-400 mb-1" /><span className="text-xs text-slate-400">Upload</span></>}
                  <input type="file" accept="image/*" className="hidden" onChange={uploadImage} disabled={uploadEnCours} />
                </label>
              </div>
              <div className="border border-dashed border-slate-300 rounded-lg p-3">
                <p className="text-xs font-medium text-slate-500 mb-2">Ou via URL</p>
                <div className="flex gap-2">
                  <Input placeholder="https://..." value={urlImageAjout} onChange={(e) => setUrlImageAjout(e.target.value)} onKeyDown={(e) => e.key === "Enter" && ajouterImageUrl()} />
                  <Button type="button" variant="outline" size="sm" onClick={ajouterImageUrl}><Plus className="w-3 h-3" /></Button>
                </div>
              </div>
            </TabsContent>

            {/* TAB VARIATIONS */}
            <TabsContent value="variations" className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
                <p className="text-blue-900 font-medium">ℹ️ Définissez les types de variations du produit</p>
                <p className="text-blue-700 text-xs mt-1">Ex: Taille → S, M, L, XL ou Couleur → Noir, Blanc, Rouge</p>
              </div>

              {variations.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="text-left p-3 font-medium">Variation</th>
                        <th className="text-left p-3 font-medium">Options</th>
                        <th className="w-12"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {variations.map((v) => (
                        <tr key={v.id}>
                          <td className="p-3 font-medium">{v.nom}</td>
                          <td className="p-3">
                            <div className="flex flex-wrap gap-1">
                              {v.options.map((o, i) => <Badge key={i} variant="outline" className="text-xs">{o}</Badge>)}
                            </div>
                          </td>
                          <td className="p-3">
                            <Button variant="ghost" size="icon" onClick={() => supprimerVariation(v.id)}>
                              <Trash2 className="w-4 h-4 text-red-400" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <Button type="button" variant="outline" onClick={() => setShowVarModal(true)}>
                <Layers className="w-4 h-4 mr-2" /> Ajouter une variation
              </Button>
            </TabsContent>

            {/* TAB STOCK */}
            <TabsContent value="stock" className="space-y-4">
              <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
                <p className="text-sm text-blue-700 font-medium mb-1">📊 Stock Global Total</p>
                <p className="text-3xl font-bold text-blue-900">{stockGlobal} unités</p>
              </div>

              {variations.length === 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
                  ⚠️ Définissez d'abord des variations dans l'onglet "Variations" avant d'ajouter du stock.
                </div>
              )}

              {stocksParCoursier.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="text-left p-3 font-medium">Coursier</th>
                        <th className="text-center p-3 font-medium">Stock</th>
                        <th className="text-left p-3 font-medium">Détail</th>
                        <th className="w-20"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {stocksParCoursier.map((sc) => (
                        <tr key={sc.coursier_id}>
                          <td className="p-3">
                            <p className="font-medium">{sc.coursier_nom}</p>
                            <p className="text-xs text-slate-500">{sc.ville}</p>
                          </td>
                          <td className="p-3 text-center font-bold">{sc.stock_total}</td>
                          <td className="p-3">
                            <div className="flex flex-wrap gap-1">
                              {(sc.stock_par_variation || []).filter((v) => v.quantite > 0).map((v, i) => (
                                <Badge key={i} variant="outline" className="text-xs">{v.variation_key.split("/").pop().trim()}: {v.quantite}</Badge>
                              ))}
                            </div>
                          </td>
                          <td className="p-3">
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" onClick={() => editStockCoursier(sc)}>
                                <Edit2 className="w-3 h-3" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => supprimerStockCoursier(sc.coursier_id)}>
                                <Trash2 className="w-3 h-3 text-red-400" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {variations.length > 0 && (
                <Button type="button" variant="outline" onClick={ouvrirStockModal}>
                  <Truck className="w-4 h-4 mr-2" /> Ajouter un coursier
                </Button>
              )}
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button onClick={onSave} disabled={enCours} className="bg-[#1a1f5e] hover:bg-[#141952]">
              {enCours ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {produit ? "Mettre à jour" : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal variation */}
      <Dialog open={showVarModal} onOpenChange={setShowVarModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Ajouter une variation</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nom de la variation *</Label>
              <Input value={newVarName} onChange={(e) => setNewVarName(e.target.value)} placeholder="Ex: Taille" />
            </div>
            <div className="space-y-2">
              <Label>Options (séparées par des virgules) *</Label>
              <Input value={newVarOptions} onChange={(e) => setNewVarOptions(e.target.value)} placeholder="Ex: S, M, L, XL" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowVarModal(false)}>Annuler</Button>
            <Button onClick={ajouterVariation} className="bg-[#1a1f5e] hover:bg-[#141952]">Ajouter</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal stock coursier */}
      <Dialog open={showStockModal} onOpenChange={setShowStockModal}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Stock par coursier</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Coursier *</Label>
              <Select value={stockForm.coursier_id} onValueChange={(v) => setStockForm((f) => ({ ...f, coursier_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Choisir un coursier" /></SelectTrigger>
                <SelectContent>
                  {coursiers.map((c) => <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Stock par variation</Label>
              <div className="space-y-2 border rounded-lg p-3">
                {stockForm.stock_par_variation.map((sv, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <span className="text-sm flex-1 truncate">{sv.variation_key}</span>
                    <Input type="number" min="0" className="w-24" value={sv.quantite}
                      onChange={(e) => {
                        const newVars = [...stockForm.stock_par_variation];
                        newVars[idx] = { ...newVars[idx], quantite: parseInt(e.target.value) || 0 };
                        setStockForm((f) => ({ ...f, stock_par_variation: newVars }));
                      }} />
                    <span className="text-xs text-slate-500">unités</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-500">
                Total: {stockForm.stock_par_variation.reduce((s, v) => s + (parseInt(v.quantite) || 0), 0)} unités
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStockModal(false)}>Annuler</Button>
            <Button onClick={ajouterStockCoursier} className="bg-[#1a1f5e] hover:bg-[#141952]">Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
