import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { uploadFile } from "@/lib/supabaseHelpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, ImagePlus, X, Plus, Trash2, Layers, Truck, Edit2, Image as ImageIcon, Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import {
  normalizeVariations,
  setStockForKey,
  renameOptionInKeys,
  recomputeCoursierTotals,
  computeStockGlobal,
} from "@/lib/variationHelpers";


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
    } catch (err) {
      console.error("uploadImage:", err);
      alert(err?.message || "Échec de l'upload. Réessayez avec une image JPEG ou PNG.");
    } finally {
      setUploadEnCours(false);
      if (e.target) e.target.value = "";
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

  // Variations — structure normalisée : [{id, nom, is_image_variation, options:[{value, image_url?, prix_gros?, prix_achat?, prix_vente_conseille?}]}]
  // En édition on garde les options à valeur vide (sinon impossible d'ajouter une nouvelle option : elle serait filtrée avant l'affichage).
  const normalizeForEditor = (vars) => {
    if (!Array.isArray(vars)) return [];
    return vars.map((v) => ({
      id: v.id || (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Math.random())),
      nom: v.nom || "",
      is_image_variation: !!v.is_image_variation,
      options: Array.isArray(v.options)
        ? v.options.map((opt) => {
            if (opt == null) return { value: "" };
            if (typeof opt === "string") return { value: opt };
            return {
              value: opt.value ?? opt.nom ?? opt.label ?? "",
              image_url: opt.image_url || opt.image || null,
              prix_gros: opt.prix_gros != null && opt.prix_gros !== "" ? Number(opt.prix_gros) : null,
              prix_achat: opt.prix_achat != null && opt.prix_achat !== "" ? Number(opt.prix_achat) : null,
              prix_vente_conseille:
                opt.prix_vente_conseille != null && opt.prix_vente_conseille !== ""
                  ? Number(opt.prix_vente_conseille)
                  : null,
            };
          })
        : [],
    }));
  };
  const variations = normalizeForEditor(form.variations || []);

  const updateVariations = (next) => setForm((p) => ({ ...p, variations: next }));

  const ajouterVariation = () => {
    if (!newVarName.trim() || !newVarOptions.trim()) return;
    const opts = newVarOptions.split(",").map((o) => o.trim()).filter(Boolean).map((v) => ({ value: v }));
    // Si aucune variation porteuse d'images n'existe encore, la 1ère devient porteuse par défaut
    const hasImageVar = variations.some((v) => v.is_image_variation);
    const newVar = {
      id: crypto.randomUUID(),
      nom: newVarName.trim(),
      is_image_variation: !hasImageVar,
      options: opts,
    };
    updateVariations([...variations, newVar]);
    setNewVarName("");
    setNewVarOptions("");
    setShowVarModal(false);
  };

  const supprimerVariation = (varId) => {
    const variationASupprimer = variations.find((v) => v.id === varId);
    const next = variations.filter((v) => v.id !== varId);
    // Si on supprime la variation porteuse d'images, promouvoir la suivante
    if (variationASupprimer?.is_image_variation && next.length > 0 && !next.some((v) => v.is_image_variation)) {
      next[0] = { ...next[0], is_image_variation: true };
    }
    setForm((p) => ({
      ...p,
      variations: next,
      stocks_par_coursier: (p.stocks_par_coursier || []).map((sc) => ({
        ...sc,
        stock_par_variation: (sc.stock_par_variation || []).filter(
          (sv) => !sv.variation_key.includes(`${variationASupprimer?.nom}:`)
        ),
      })),
    }));
  };

  const toggleImageVariation = (varId) => {
    updateVariations(variations.map((v) => ({ ...v, is_image_variation: v.id === varId })));
  };

  const updateOption = (varId, optIndex, patch) => {
    const v = variations.find((vv) => vv.id === varId);
    const oldVal = v?.options[optIndex]?.value;
    updateVariations(
      variations.map((vv) => {
        if (vv.id !== varId) return vv;
        const opts = vv.options.map((o, i) => (i === optIndex ? { ...o, ...patch } : o));
        return { ...vv, options: opts };
      })
    );
    // Si la valeur change, propager dans toutes les variation_key des coursiers
    if (patch.value !== undefined && v && oldVal && patch.value !== oldVal) {
      setForm((p) => ({
        ...p,
        stocks_par_coursier: recomputeCoursierTotals(
          renameOptionInKeys(p.stocks_par_coursier || [], v.nom, oldVal, patch.value)
        ),
      }));
    }
  };


  const uploadOptionImage = async (varId, optIndex, file) => {
    if (!file) return;
    setUploadEnCours(true);
    try {
      const { file_url } = await uploadFile(file);
      updateOption(varId, optIndex, { image_url: file_url });
    } catch (err) {
      console.error("uploadOptionImage:", err);
      alert(err?.message || "Échec de l'upload. Réessayez avec une image JPEG ou PNG.");
    } finally {
      setUploadEnCours(false);
    }
  };


  // Generate all variation keys from defined variations
  const getVariationKeys = () => {
    if (variations.length === 0) return [];
    if (variations.length === 1) {
      return variations[0].options.map((opt) => `${variations[0].nom}:${opt.value}`);
    }
    let keys = variations[0].options.map((o) => `${variations[0].nom}:${o.value}`);
    for (let i = 1; i < variations.length; i++) {
      const newKeys = [];
      for (const key of keys) {
        for (const opt of variations[i].options) {
          newKeys.push(`${key} / ${variations[i].nom}:${opt.value}`);
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

  // Calculate global stock (dérivé)
  const stockGlobal = computeStockGlobal(stocksParCoursier);

  // Helper inline pour la matrice par option
  const getQty = (coursierId, variationKey) => {
    const sc = stocksParCoursier.find((s) => s.coursier_id === coursierId);
    const sv = sc?.stock_par_variation?.find((v) => v.variation_key === variationKey);
    return sv?.quantite ?? 0;
  };
  const setQty = (coursierId, variationKey, qty) => {
    const coursier = coursiers.find((c) => c.id === coursierId);
    const ville = villes.find((v) => v.id === coursier?.ville_id);
    setForm((p) => ({
      ...p,
      stocks_par_coursier: setStockForKey(
        p.stocks_par_coursier || [],
        coursierId,
        variationKey,
        qty,
        { coursier_nom: coursier?.nom || "", ville: ville?.nom || "" }
      ),
    }));
  };
  // Pour une option donnée d'une variation, renvoie toutes les variation_key correspondantes
  const keysForOption = (varName, value) => {
    const seg = `${varName}:${value}`;
    if (variationKeys.length === 0) return [seg];
    return variationKeys.filter((k) =>
      k.split(/\s*\/\s*|\|/).some((s) => s.trim() === seg)
    );
  };


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
                <div className="col-span-2 space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={form.description || ""}
                    onChange={(e) => modifier("description", e.target.value)}
                    rows={6}
                    className="min-h-[140px] resize-y leading-6"
                    placeholder="Description détaillée du produit. Utilisez Entrée pour créer des paragraphes."
                  />
                </div>
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

            {/* TAB IMAGES — Image principale du produit (vitrine catalogue) */}
            <TabsContent value="images" className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900">
                <p className="font-medium">🖼️ Image principale du produit (vitrine catalogue & partage).</p>
                <p className="mt-1">Les images liées aux variations (ex : couleurs) se gèrent dans l'onglet <strong>Variations</strong>.</p>
              </div>
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
                  <input type="file" accept="image/*,.heic,.heif" className="hidden" onChange={uploadImage} disabled={uploadEnCours} />
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

            {/* TAB VARIATIONS — éditeur par option (image + prix facultatifs) */}
            <TabsContent value="variations" className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
                <p className="text-blue-900 font-medium">ℹ️ Définissez les types de variations du produit</p>
                <p className="text-blue-700 text-xs mt-1">
                  Activez « Porte les images » sur la variation qui distingue visuellement les déclinaisons (ex : Couleur). Les prix par option sont facultatifs et écrasent le prix produit.
                </p>
              </div>

              {variations.map((v) => (
                <div key={v.id} className="border rounded-lg overflow-hidden">
                  <div className="flex items-center justify-between gap-3 p-3 bg-slate-50 border-b">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">{v.nom}</p>
                      <p className="text-xs text-slate-500">{v.options.length} option(s)</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                        <ImageIcon className="w-3.5 h-3.5" /> Porte les images
                        <Switch checked={v.is_image_variation} onCheckedChange={() => toggleImageVariation(v.id)} />
                      </label>
                      <Button variant="ghost" size="icon" onClick={() => supprimerVariation(v.id)}>
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </Button>
                    </div>
                  </div>

                  <div className="divide-y">
                    {v.options.map((opt, idx) => (
                      <div key={idx} className="p-3 flex gap-3 items-start">
                        {v.is_image_variation ? (
                          <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-slate-200 bg-slate-50 flex-shrink-0">
                            {opt.image_url ? (
                              <>
                                <img src={opt.image_url} alt={opt.value} className="w-full h-full object-cover" />
                                <button
                                  onClick={() => updateOption(v.id, idx, { image_url: null })}
                                  className="absolute top-0 right-0 w-5 h-5 bg-red-500 text-white rounded-bl flex items-center justify-center"
                                  type="button"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </>
                            ) : (
                              <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer text-slate-400 text-[10px]">
                                <ImagePlus className="w-4 h-4 mb-0.5" /> Image
                                <input
                                  type="file"
                                  accept="image/*,.heic,.heif"
                                  className="hidden"
                                  onChange={(e) => uploadOptionImage(v.id, idx, e.target.files?.[0])}
                                  disabled={uploadEnCours}
                                />
                              </label>
                            )}
                          </div>
                        ) : null}

                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="flex items-center gap-2">
                            <Tag className="w-3.5 h-3.5 text-slate-400" />
                            <Input
                              value={opt.value}
                              onChange={(e) => updateOption(v.id, idx, { value: e.target.value })}
                              className="h-8 text-sm"
                              placeholder="Nom de l'option"
                            />
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => updateVariations(variations.map((vv) => vv.id === v.id ? { ...vv, options: vv.options.filter((_, i) => i !== idx) } : vv))}>
                              <Trash2 className="w-3.5 h-3.5 text-red-400" />
                            </Button>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <Input
                              type="number" min="0" placeholder="Prix gros"
                              className="h-8 text-xs"
                              value={opt.prix_gros ?? ""}
                              onChange={(e) => updateOption(v.id, idx, { prix_gros: e.target.value === "" ? null : Number(e.target.value) })}
                            />
                            <Input
                              type="number" min="0" placeholder="Prix achat"
                              className="h-8 text-xs"
                              value={opt.prix_achat ?? ""}
                              onChange={(e) => updateOption(v.id, idx, { prix_achat: e.target.value === "" ? null : Number(e.target.value) })}
                            />
                            <Input
                              type="number" min="0" placeholder="Vente conseil."
                              className="h-8 text-xs"
                              value={opt.prix_vente_conseille ?? ""}
                              onChange={(e) => updateOption(v.id, idx, { prix_vente_conseille: e.target.value === "" ? null : Number(e.target.value) })}
                            />
                          </div>
                          {/* Stock par coursier pour cette option */}
                          {coursiers.length > 0 && (() => {
                            const keys = keysForOption(v.nom, opt.value);
                            // Si la variation est combinée à d'autres, on saisit par combinaison
                            const combos = keys.length > 0 ? keys : [`${v.nom}:${opt.value}`];
                            return (
                              <div className="border rounded-md bg-slate-50/50 p-2 space-y-1.5">
                                <p className="text-[10px] uppercase tracking-wide text-slate-500 font-medium">
                                  Stock par coursier {variations.length > 1 ? "(par combinaison)" : ""}
                                </p>
                                {combos.map((vk) => (
                                  <div key={vk}>
                                    {variations.length > 1 && (
                                      <p className="text-[10px] text-slate-500 mb-1 truncate">{vk}</p>
                                    )}
                                    <div className="grid grid-cols-2 gap-1.5">
                                      {coursiers.map((c) => {
                                        const ville = villes.find((vv) => vv.id === c.ville_id);
                                        return (
                                          <div key={c.id} className="flex items-center gap-1.5">
                                            <span className="text-[11px] text-slate-600 flex-1 truncate" title={`${c.nom} • ${ville?.nom || ""}`}>
                                              {c.nom}
                                            </span>
                                            <Input
                                              type="number" min="0"
                                              className="h-7 w-16 text-xs"
                                              value={getQty(c.id, vk)}
                                              onFocus={(e) => { if (e.target.value === "0") e.target.value = ""; }}
                                              onChange={(e) => setQty(c.id, vk, e.target.value === "" ? 0 : parseInt(e.target.value, 10))}
                                            />
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            );
                          })()}
                        </div>

                      </div>
                    ))}
                    <div className="p-2 bg-slate-50">
                      <Button
                        type="button" variant="ghost" size="sm" className="text-xs"
                        onClick={() => updateVariations(variations.map((vv) => vv.id === v.id ? { ...vv, options: [...vv.options, { value: "" }] } : vv))}
                      >
                        <Plus className="w-3 h-3 mr-1" /> Ajouter une option
                      </Button>
                    </div>
                  </div>
                </div>
              ))}

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
