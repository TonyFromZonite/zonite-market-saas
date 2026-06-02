import React, { useState, useEffect, useMemo } from "react";
import { getVendeurSessionAsync } from "@/components/useSessionGuard";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, Loader2, ChevronLeft, AlertCircle, Truck, ChevronDown } from "lucide-react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Badge } from "@/components/ui/badge";
import BlocageKycPending from "@/components/BlocageKycPending";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { normalizeVariations, isOptionAvailable, isOptionAvailableInCoursiers, getCoursierIdsForVille, getEffectivePrices, getDisplayImage } from "@/lib/variationHelpers";

export default function NouvelleCommandeVendeur() {
  const [compteVendeur, setCompteVendeur] = useState(null);
  const [form, setForm] = useState(() => {
    let modeInitial = "separe";
    try {
      const saved = localStorage.getItem("zonite_mode_paiement_livraison");
      if (saved === "inclus" || saved === "separe") modeInitial = saved;
    } catch {}
    return {
      produit_id: "", quantite: 1, prix_final_client: "",
      client_nom: "", client_telephone: "", client_adresse: "",
      notes: "",
      mode_paiement_livraison: modeInitial, // persisté entre les commandes
    };
  });
  const [villeText, setVilleText] = useState("");
  const [quartierText, setQuartierText] = useState("");
  const [showVilleSuggestions, setShowVilleSuggestions] = useState(false);
  const [showQuartierSuggestions, setShowQuartierSuggestions] = useState(false);
  const [selectedVariations, setSelectedVariations] = useState({});
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  const [localStorageDisponible] = useState(() => {
    try {
      const k = "__zonite_ls_test__";
      localStorage.setItem(k, "1");
      localStorage.removeItem(k);
      return true;
    } catch {
      return false;
    }
  });
  const [succes, setSucces] = useState(false);
  const [openProduit, setOpenProduit] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const queryClient = useQueryClient();

  const location = useLocation();
  const prefilledProduct = location.state;

  useEffect(() => {
    const charger = async () => {
      const session = await getVendeurSessionAsync();
      if (!session) { window.location.href = createPageUrl("Connexion"); return; }
      const { data: seller } = await supabase
        .from("sellers").select("*").eq("id", session.id).maybeSingle();
      if (seller) {
        setCompteVendeur(seller);
      } else {
        setErreur("Compte vendeur introuvable. Veuillez vous reconnecter.");
      }
      if (prefilledProduct?.produit_id) {
        setForm((f) => ({ ...f, produit_id: prefilledProduct.produit_id }));
        if (prefilledProduct.selected_variations && typeof prefilledProduct.selected_variations === "object") {
          setSelectedVariations(prefilledProduct.selected_variations);
        }
      } else {
        const params = new URLSearchParams(window.location.search);
        const produitId = params.get("produit_id");
        if (produitId) setForm((f) => ({ ...f, produit_id: produitId }));
      }
    };
    charger();
  }, []);

  const { data: produits = [] } = useQuery({
    queryKey: ["produits_actifs"],
    queryFn: async () => {
      const { data } = await supabase.from("produits").select("*").eq("actif", true);
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

  const { data: quartiers = [] } = useQuery({
    queryKey: ["quartiers"],
    queryFn: async () => {
      const { data } = await supabase.from("quartiers").select("*").eq("actif", true).order("nom");
      return data || [];
    },
  });

  const { data: coursiers = [] } = useQuery({
    queryKey: ["coursiers"],
    queryFn: async () => {
      const { data } = await supabase.from("coursiers").select("*").eq("actif", true);
      return data || [];
    },
  });

  const { data: zonesLivraison = [] } = useQuery({
    queryKey: ["zones_livraison"],
    queryFn: async () => {
      const { data } = await supabase.from("zones_livraison").select("*").eq("actif", true);
      return data || [];
    },
  });

  const modifier = (champ, val) => {
    setForm((p) => ({ ...p, [champ]: val }));
    setErreur("");
    if (champ === "mode_paiement_livraison") {
      try { localStorage.setItem("zonite_mode_paiement_livraison", val); } catch {}
    }
  };
  const produitSelectionne = produits.find((p) => p.id === form.produit_id);
  const variations = useMemo(() => normalizeVariations(produitSelectionne?.variations), [produitSelectionne]);
  const effectivePrices = useMemo(() => getEffectivePrices(produitSelectionne, selectedVariations), [produitSelectionne, selectedVariations]);
  const displayImage = useMemo(() => getDisplayImage(produitSelectionne, selectedVariations), [produitSelectionne, selectedVariations]);

  // Build variation key — empty string until ALL variations are selected,
  // so stock checks fall back to stock_total instead of looking up an
  // incomplete variation_key (which would always return 0 stock).
  const getVariationKey = () => {
    if (variations.length === 0) return "";
    const allSelected = variations.every((v) => selectedVariations[v.nom]);
    if (!allSelected) return "";
    return variations.map((v) => `${v.nom}:${selectedVariations[v.nom]}`).join("|");
  };
  const variationKey = getVariationKey();

  // --- Ville suggestions ---
  const villeSuggestions = useMemo(() => {
    if (!villeText || villeText.length < 1) return [];
    const t = villeText.toLowerCase();
    return villes.filter((v) => v.nom.toLowerCase().includes(t)).slice(0, 8);
  }, [villeText, villes]);

  // --- Quartier suggestions (filtered by matched ville) ---
  const matchedVille = useMemo(() => {
    if (!villeText) return null;
    return villes.find((v) => v.nom.toLowerCase() === villeText.toLowerCase().trim());
  }, [villeText, villes]);

  const quartierSuggestions = useMemo(() => {
    if (!quartierText || quartierText.length < 1) return [];
    const t = quartierText.toLowerCase();
    const filtered = matchedVille
      ? quartiers.filter((q) => q.ville_id === matchedVille.id)
      : quartiers;
    return filtered.filter((q) => q.nom.toLowerCase().includes(t)).slice(0, 8);
  }, [quartierText, quartiers, matchedVille]);

  // Quartier exact dans la ville (utilisé pour filtrer dispo + livraison)
  const matchedQuartier = useMemo(() => {
    if (!matchedVille || !quartierText.trim()) return null;
    return quartiers.find(
      (q) => q.nom.toLowerCase() === quartierText.toLowerCase().trim() && q.ville_id === matchedVille.id
    ) || null;
  }, [quartierText, quartiers, matchedVille]);

  // Coursiers qui livrent dans cette ville/quartier — filtre la dispo des variations
  const coursierIdsForLocation = useMemo(() => {
    if (!matchedVille) return null; // pas de ville saisie → pas de filtre, dispo globale
    return getCoursierIdsForVille(coursiers, zonesLivraison, quartiers, matchedVille.id, matchedQuartier?.id);
  }, [matchedVille, matchedQuartier, coursiers, zonesLivraison, quartiers]);

  // --- Check stock exists in this city ---
  const stockInCity = useMemo(() => {
    if (!produitSelectionne || !villeText) return { available: false, total: 0 };
    if (!matchedVille) return { available: false, total: 0 };

    const villeZones = zonesLivraison.filter((z) => z.ville_id === matchedVille.id);
    const villeZoneIds = villeZones.map((z) => z.id);

    // Find coursiers covering these zones
    const coursiersInVille = coursiers.filter((c) =>
      (c.zones_livraison_ids || []).some((zid) => villeZoneIds.includes(zid))
    );

    // Also include coursiers directly in this ville (via ville_id)
    const coursiersById = coursiers.filter((c) => c.ville_id === matchedVille.id);
    const allCoursierIds = new Set([...coursiersInVille.map(c => c.id), ...coursiersById.map(c => c.id)]);

    const spc = produitSelectionne.stocks_par_coursier || [];
    let totalStock = 0;
    for (const s of spc) {
      if (!allCoursierIds.has(s.coursier_id)) continue;
      if (variationKey && variations.length > 0) {
        const sv = (s.stock_par_variation || []).find((v) => v.variation_key === variationKey);
        totalStock += sv?.quantite || 0;
      } else {
        totalStock += s.stock_total || 0;
      }
    }
    return { available: totalStock > 0, total: totalStock };
  }, [produitSelectionne, matchedVille, coursiers, zonesLivraison, variationKey]);

  // --- Delivery fee estimation ---
  const estimationLivraison = useMemo(() => {
    if (!villeText.trim()) return null;

    if (!matchedVille) {
      return { min: 1500, max: 1500, unknown: true };
    }

    // Find zones in this ville
    const villeZones = zonesLivraison.filter((z) => z.ville_id === matchedVille.id);
    const villeZoneIds = villeZones.map((z) => z.id);

    // Find matched quartier
    const matchedQuartier = quartierText.trim()
      ? quartiers.find((q) => q.nom.toLowerCase() === quartierText.toLowerCase().trim() && q.ville_id === matchedVille.id)
      : null;

    let relevantZoneIds = villeZoneIds;
    if (matchedQuartier) {
      // Find zones containing this quartier
      const zonesWithQuartier = villeZones.filter((z) =>
        (z.quartiers_ids || []).includes(matchedQuartier.id)
      );
      if (zonesWithQuartier.length > 0) {
        relevantZoneIds = zonesWithQuartier.map((z) => z.id);
      }
    }

    // Find coursiers covering these zones
    const matchingCoursiers = coursiers.filter((c) =>
      (c.zones_livraison_ids || []).some((zid) => relevantZoneIds.includes(zid))
    );

    // Also include coursiers by ville_id
    const coursiersById = coursiers.filter((c) => c.ville_id === matchedVille.id);
    const all = [...matchingCoursiers, ...coursiersById];
    const unique = Array.from(new Map(all.map(c => [c.id, c])).values());

    if (unique.length === 0) {
      return { min: 1500, max: 1500, unknown: true };
    }

    const fees = unique.map((c) => c.frais_livraison_defaut || 0).filter(f => f > 0);
    if (fees.length === 0) return { min: 0, max: 0, unknown: false };

    return {
      min: Math.min(...fees),
      max: Math.max(...fees),
      unknown: false,
    };
  }, [villeText, quartierText, matchedVille, coursiers, zonesLivraison, quartiers]);

  const qte = parseInt(form.quantite) || 1;
  const prixGros = effectivePrices.prix_gros || 0;
  const prixFinal = parseFloat(form.prix_final_client) || 0;
  const fraisLivraisonEstime = estimationLivraison
    ? Math.round((estimationLivraison.min + estimationLivraison.max) / 2)
    : 1500;
  const livraisonIncluse = form.mode_paiement_livraison === "inclus";
  const commissionBrute = Math.max(0, (prixFinal - prixGros) * qte);
  const commission = livraisonIncluse
    ? Math.max(0, commissionBrute - fraisLivraisonEstime)
    : commissionBrute;
  const formater = (n) => `${Math.round(n || 0).toLocaleString("fr-FR")} FCFA`;

  const soumettre = async () => {
    if (!compteVendeur) return setErreur("Compte vendeur non chargé.");
    if (!form.produit_id) return setErreur("Sélectionnez un produit.");
    if (variations.length > 0 && Object.values(selectedVariations).some((v) => !v)) return setErreur("Sélectionnez toutes les variations.");
    if (!villeText.trim()) return setErreur("Renseignez la ville du client.");
    if (qte < 1) return setErreur("La quantité doit être au moins 1.");
    if (!prixFinal || prixFinal < prixGros) return setErreur(`Le prix final doit être ≥ ${formater(prixGros)}`);
    if (!form.client_nom || !form.client_telephone) return setErreur("Renseignez les informations du client.");
    if (form.mode_paiement_livraison !== "inclus" && form.mode_paiement_livraison !== "separe") {
      return setErreur("Veuillez préciser le mode de paiement de la livraison (incluse dans le prix ou payée séparément au livreur).");
    }
    if (livraisonIncluse && prixFinal * qte < prixGros * qte + fraisLivraisonEstime) {
      return setErreur(`Livraison incluse : le prix final total doit couvrir le prix de gros + frais de livraison estimés (${formater(prixGros * qte + fraisLivraisonEstime)}).`);
    }

    // Validate stock exists in city (if ville is known)
    if (matchedVille && !stockInCity.available) {
      return setErreur("Stock insuffisant dans cette ville. Aucun coursier n'a du stock disponible.");
    }
    if (matchedVille && stockInCity.total < qte) {
      return setErreur(`Stock insuffisant dans cette ville. Disponible: ${stockInCity.total} unité(s).`);
    }

    setEnCours(true);
    setErreur("");

    try {
      const ref = `CMD-${Date.now().toString(36).toUpperCase()}`;
      const { data: newOrder, error: orderError } = await supabase.from("commandes_vendeur").insert({
        vendeur_id: compteVendeur.id,
        vendeur_email: compteVendeur.email,
        produit_id: form.produit_id,
        produit_nom: produitSelectionne.nom,
        produit_reference: produitSelectionne.reference || null,
        variation: variationKey || null,
        quantite: qte,
        prix_unitaire: prixGros,
        prix_final_client: prixFinal,
        montant_total: prixFinal * qte,
        frais_livraison: fraisLivraisonEstime,
        livraison_incluse: livraisonIncluse,
        coursier_id: null,
        client_nom: form.client_nom,
        client_telephone: form.client_telephone,
        client_ville: villeText.trim(),
        client_quartier: quartierText.trim() || null,
        client_adresse: form.client_adresse,
        notes: form.notes,
        reference_commande: ref,
        statut: "en_attente_validation_admin",
        stock_reserve: false,
        stock_retire_definitif: false,
      }).select().single();

      if (orderError) throw orderError;

      // Admin notification
      await supabase.from("notifications_admin").insert({
        titre: "🛒 Nouvelle commande",
        message: `${compteVendeur.full_name} a commandé ${qte}x ${produitSelectionne.nom} (${variationKey || "standard"}) pour ${form.client_nom} à ${villeText.trim()}`,
        type: "commande",
        vendeur_email: compteVendeur.email,
        reference_id: newOrder.id,
      });

      queryClient.invalidateQueries({ queryKey: ["commandes_vendeur"] });
      queryClient.invalidateQueries({ queryKey: ["produits_actifs"] });
      setEnCours(false);
      setSucces(true);
    } catch (err) {
      setErreur(err.message || "Erreur lors de la création");
      setEnCours(false);
    }
  };

  if (compteVendeur && compteVendeur.seller_status === "kyc_pending") {
    return <BlocageKycPending titre="Nouvelle commande" />;
  }

  if (succes) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center shadow-lg">
          <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-900 mb-2">Commande envoyée !</h2>
          <p className="text-sm text-slate-500 mb-6">Votre commande a été transmise à l'équipe ZONITE. Un coursier sera attribué par l'administration.</p>
          <div className="space-y-3">
            <Button onClick={() => { setSucces(false); setForm((f) => ({ ...f, client_nom: "", client_telephone: "", client_adresse: "", notes: "" })); setSelectedVariations({}); setVilleText(""); setQuartierText(""); }}
              className="w-full bg-[#1a1f5e] hover:bg-[#141952]">Nouvelle commande</Button>
            <Link to={createPageUrl("MesCommandesVendeur")}>
              <Button variant="outline" className="w-full">Voir mes commandes</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-8">
      <div className="bg-[#1a1f5e] text-white px-4 pb-4" style={{ paddingTop: "max(1.25rem, env(safe-area-inset-top, 0px))" }}>
        <div className="flex items-center gap-3">
          <Link to={createPageUrl("EspaceVendeur")}><ChevronLeft className="w-6 h-6 text-white" /></Link>
          <h1 className="text-lg font-bold">Nouvelle commande</h1>
        </div>
      </div>

      <div className="p-4 space-y-4 max-w-lg mx-auto">
        {erreur && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />{erreur}
          </div>
        )}

        {/* Produit */}
        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
          <h2 className="font-semibold text-slate-900 text-sm">Produit</h2>
          <Popover open={openProduit} onOpenChange={setOpenProduit}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={openProduit}
                className="w-full justify-between h-auto py-2 px-3"
              >
                {produitSelectionne ? (
                  <div className="flex items-center gap-3">
                    {Array.isArray(produitSelectionne.images) && produitSelectionne.images.length > 0 ? (
                      <img src={produitSelectionne.images[0]} alt={produitSelectionne.nom} className="w-10 h-10 rounded-md object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-md bg-slate-100 flex items-center justify-center flex-shrink-0">
                        <Truck className="w-5 h-5 text-slate-400" />
                      </div>
                    )}
                    <div className="text-left">
                      <div className="font-medium text-sm">{produitSelectionne.nom}</div>
                      <div className="text-xs text-slate-500">Stock: {produitSelectionne.stock_global || 0}</div>
                    </div>
                  </div>
                ) : (
                  <span className="text-muted-foreground">Choisir un produit</span>
                )}
                <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
              <Command>
                <CommandInput placeholder="Rechercher un produit..." />
                <CommandList>
                  <CommandEmpty>Aucun produit trouvé.</CommandEmpty>
                  <CommandGroup>
                    {produits.map((p) => (
                      <CommandItem
                        key={p.id}
                        value={p.id}
                        keywords={[p.nom, p.reference || ""]}
                        onSelect={(currentValue) => {
                          modifier("produit_id", currentValue);
                          setSelectedVariations({});
                          setOpenProduit(false);
                        }}
                        className="cursor-pointer"
                      >
                        <div className="flex items-center gap-3 w-full">
                          {Array.isArray(p.images) && p.images.length > 0 ? (
                            <img src={p.images[0]} alt={p.nom} className="w-10 h-10 rounded-md object-cover flex-shrink-0" loading="lazy" />
                          ) : (
                            <div className="w-10 h-10 rounded-md bg-slate-100 flex items-center justify-center flex-shrink-0">
                              <Truck className="w-5 h-5 text-slate-400" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{p.nom}</div>
                            <div className="text-xs text-slate-500">Stock: {p.stock_global || 0}</div>
                          </div>
                          {form.produit_id === p.id && <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />}
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          {/* Variations — sélection visuelle pour la variation image, chips sinon, options en rupture désactivées */}
          {produitSelectionne && variations.length > 0 && (
            <div className="space-y-3">
              {variations.map((v) => (
                <div key={v.id || v.nom} className="space-y-1.5">
                  <Label>{v.nom} *</Label>
                  {v.is_image_variation ? (
                    <div className="grid grid-cols-4 gap-2">
                      {v.options.map((opt) => {
                        const available = coursierIdsForLocation
                          ? isOptionAvailableInCoursiers(produitSelectionne, v.nom, opt.value, coursierIdsForLocation)
                          : isOptionAvailable(produitSelectionne, v.nom, opt.value);
                        const ruptureLabel = coursierIdsForLocation ? `Rupture à ${matchedVille?.nom || ""}`.trim() : "Rupture";
                        const isSelected = selectedVariations[v.nom] === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            disabled={!available}
                            onClick={() => setSelectedVariations((prev) => ({ ...prev, [v.nom]: opt.value }))}
                            className={`relative rounded-lg border-2 overflow-hidden transition-all ${isSelected ? "border-amber-500" : "border-slate-200"} ${!available ? "opacity-40 cursor-not-allowed grayscale" : "cursor-pointer"}`}
                          >
                            {opt.image_url ? (
                              <img src={opt.image_url} alt={opt.value} className="w-full aspect-square object-cover" />
                            ) : (
                              <div className="w-full aspect-square bg-slate-100 flex items-center justify-center text-[10px] text-slate-500 p-1 text-center">{opt.value}</div>
                            )}
                            <p className="text-[10px] text-center py-0.5 bg-white truncate">{opt.value}</p>
                            {!available && <span className="absolute top-0.5 right-0.5 text-[8px] bg-red-500 text-white rounded px-1">{ruptureLabel}</span>}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {v.options.map((opt) => {
                        const available = isOptionAvailable(produitSelectionne, v.nom, opt.value);
                        const isSelected = selectedVariations[v.nom] === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            disabled={!available}
                            onClick={() => setSelectedVariations((prev) => ({ ...prev, [v.nom]: opt.value }))}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${isSelected ? "bg-amber-500 text-white border-amber-500" : "bg-white text-slate-700 border-slate-200"} ${!available ? "opacity-40 cursor-not-allowed line-through" : ""}`}
                          >
                            {opt.value}{!available && " • Rupture"}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {produitSelectionne && (
            <div className="bg-slate-50 rounded-xl p-3 text-sm">
              <p className="text-slate-500">Prix de gros : <span className="font-bold text-slate-900">{formater(prixGros)}</span></p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Quantité *</Label>
              <Input type="number" min="1" value={form.quantite} onChange={(e) => modifier("quantite", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Prix final client (FCFA) *</Label>
              <Input type="number" min="0" value={form.prix_final_client} onChange={(e) => modifier("prix_final_client", e.target.value)} />
            </div>
          </div>

          {prixFinal >= prixGros && prixFinal > 0 && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-sm">
              <p className="text-slate-600">Votre commission estimée :</p>
              <p className="font-bold text-emerald-700 text-lg">{formater(commission)}</p>
              {livraisonIncluse && (
                <p className="text-xs text-slate-500 mt-1">
                  (Commission brute {formater(commissionBrute)} − frais livraison {formater(fraisLivraisonEstime)})
                </p>
              )}
            </div>
          )}
        </div>

        {/* Mode de paiement livraison */}
        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
          <h2 className="font-semibold text-slate-900 text-sm">Paiement de la livraison</h2>
          {!localStorageDisponible && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              Mode navigation privée détecté. Votre choix sera conservé pendant cette session, mais ne sera pas mémorisé après rechargement.
            </div>
          )}
          <div className="grid grid-cols-1 gap-2">
            <button
              type="button"
              onClick={() => modifier("mode_paiement_livraison", "separe")}
              className={`text-left p-3 rounded-xl border-2 transition-all ${form.mode_paiement_livraison === "separe" ? "border-[#1a1f5e] bg-blue-50" : "border-slate-200 bg-white"}`}
            >
              <p className="font-semibold text-sm text-slate-900">Le client paie la livraison au livreur</p>
              <p className="text-xs text-slate-500 mt-1">Le client règle séparément les frais de livraison au livreur à la réception. Votre commission n'est pas impactée.</p>
            </button>
            <button
              type="button"
              onClick={() => modifier("mode_paiement_livraison", "inclus")}
              className={`text-left p-3 rounded-xl border-2 transition-all ${form.mode_paiement_livraison === "inclus" ? "border-[#1a1f5e] bg-blue-50" : "border-slate-200 bg-white"}`}
            >
              <p className="font-semibold text-sm text-slate-900">Les frais de livraison sont inclus dans le prix</p>
              <p className="text-xs text-slate-500 mt-1">Le prix affiché au client comprend déjà la livraison. Les frais seront déduits de votre commission.</p>
            </button>
          </div>
        </div>


        {/* Localisation */}
        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
          <h2 className="font-semibold text-slate-900 text-sm">Livraison</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1 relative">
              <Label>Ville *</Label>
              <Input
                value={villeText}
                onChange={(e) => { setVilleText(e.target.value); setShowVilleSuggestions(true); setErreur(""); }}
                onFocus={() => setShowVilleSuggestions(true)}
                onBlur={() => setTimeout(() => setShowVilleSuggestions(false), 200)}
                placeholder="Tapez une ville..."
              />
              {showVilleSuggestions && villeSuggestions.length > 0 && (
                <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {villeSuggestions.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 transition-colors"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => { setVilleText(v.nom); setShowVilleSuggestions(false); }}
                    >
                      {v.nom}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-1 relative">
              <Label>Quartier</Label>
              <Input
                value={quartierText}
                onChange={(e) => { setQuartierText(e.target.value); setShowQuartierSuggestions(true); }}
                onFocus={() => setShowQuartierSuggestions(true)}
                onBlur={() => setTimeout(() => setShowQuartierSuggestions(false), 200)}
                placeholder="Tapez un quartier..."
              />
              {showQuartierSuggestions && quartierSuggestions.length > 0 && (
                <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {quartierSuggestions.map((q) => (
                    <button
                      key={q.id}
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 transition-colors"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => { setQuartierText(q.nom); setShowQuartierSuggestions(false); }}
                    >
                      {q.nom}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Estimation livraison */}
          {villeText.trim() && estimationLivraison && (
            <div className={`rounded-lg p-3 text-sm flex items-center gap-2 ${estimationLivraison.unknown ? "bg-amber-50 border border-amber-200" : "bg-blue-50 border border-blue-200"}`}>
              <Truck className="w-4 h-4 flex-shrink-0" />
              <div>
                <p className="font-medium">
                  {estimationLivraison.unknown
                    ? "Estimation livraison : 1 500 FCFA (zone non référencée)"
                    : estimationLivraison.min === estimationLivraison.max
                      ? `Estimation livraison : ${formater(estimationLivraison.min)}`
                      : `Estimation livraison : ${formater(estimationLivraison.min)} — ${formater(estimationLivraison.max)}`
                  }
                </p>
                <p className="text-xs text-slate-500 mt-0.5">Le prix final sera confirmé par l'admin lors de l'attribution du coursier.</p>
              </div>
            </div>
          )}

          {/* Stock availability in city */}
          {villeText.trim() && produitSelectionne && matchedVille && (
            <div className={`rounded-lg p-3 text-sm ${stockInCity.available ? "bg-emerald-50 border border-emerald-200 text-emerald-700" : "bg-red-50 border border-red-200 text-red-700"}`}>
              {stockInCity.available
                ? `✅ Stock disponible dans cette ville : ${stockInCity.total} unité(s)`
                : "❌ Aucun stock disponible dans cette ville pour ce produit/variation."
              }
            </div>
          )}

          {villeText.trim() && produitSelectionne && !matchedVille && (
            <div className="rounded-lg p-3 text-sm bg-amber-50 border border-amber-200 text-amber-700">
              ⚠️ Ville non référencée — la vérification du stock sera faite par l'admin.
            </div>
          )}
        </div>

        {/* Client */}
        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
          <h2 className="font-semibold text-slate-900 text-sm">Client</h2>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Nom *</Label><Input value={form.client_nom} onChange={(e) => modifier("client_nom", e.target.value)} /></div>
            <div className="space-y-1"><Label>Téléphone *</Label><Input value={form.client_telephone} onChange={(e) => modifier("client_telephone", e.target.value)} placeholder="+237 6XX XXX XXX" /></div>
            <div className="space-y-1"><Label>Adresse précise</Label><Input value={form.client_adresse} onChange={(e) => modifier("client_adresse", e.target.value)} /></div>
            <div className="space-y-1"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => modifier("notes", e.target.value)} rows={2} /></div>
          </div>
        </div>

        {/* Summary */}
        {produitSelectionne && prixFinal > 0 && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border-2 border-[#1a1f5e]">
            <h2 className="font-semibold text-slate-900 text-sm mb-3">📋 Résumé de la commande</h2>
            <div className="flex gap-3">
              {displayImage ? (
                <img src={displayImage} alt={produitSelectionne.nom} className="w-16 h-16 rounded-lg object-cover flex-shrink-0 border border-slate-200" loading="lazy" />
              ) : (
                <div className="w-16 h-16 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0 border border-slate-200">
                  <Truck className="w-6 h-6 text-slate-400" />
                </div>
              )}
              <div className="space-y-1 text-sm flex-1 min-w-0">
                <p>Produit: <strong>{produitSelectionne.nom}</strong> {variationKey && `(${variationKey})`}</p>
                <p>Quantité: <strong>{qte}</strong></p>
                <p>Prix unitaire: <strong>{formater(prixFinal)}</strong></p>
                <p>Montant total: <strong>{formater(prixFinal * qte)}</strong></p>
                <p>Livraison: <strong>{villeText.trim() || "—"}{quartierText.trim() ? `, ${quartierText.trim()}` : ""}</strong></p>
                {estimationLivraison && (
                  livraisonIncluse ? (
                    <p>Livraison : <strong>incluse dans le prix</strong> <span className="text-xs text-slate-500">(≈ {formater(fraisLivraisonEstime)} déduits de votre commission)</span></p>
                  ) : (
                    <p>À régler au livreur : <strong>
                      {estimationLivraison.min === estimationLivraison.max
                        ? formater(estimationLivraison.min)
                        : `${formater(estimationLivraison.min)} — ${formater(estimationLivraison.max)}`}
                    </strong></p>
                  )
                )}
                <p>Commission estimée : <strong className="text-emerald-700">{formater(commission)}</strong></p>
                <p className="text-xs text-slate-400">Le coursier sera attribué par l'administration.</p>
              </div>
            </div>
          </div>
        )}

        <Button onClick={() => setConfirmOpen(true)} disabled={enCours} className="w-full h-12 bg-[#1a1f5e] hover:bg-[#141952] text-white font-bold text-base">
          {enCours ? <Loader2 className="w-5 h-5 animate-spin" /> : "Envoyer la commande →"}
        </Button>

        <Dialog open={confirmOpen} onOpenChange={(o) => { if (!enCours) setConfirmOpen(o); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Confirmer la commande</DialogTitle>
              <DialogDescription>Vérifiez les informations du produit avant l'envoi à l'administration.</DialogDescription>
            </DialogHeader>
            {produitSelectionne ? (
              <div className="space-y-3">
                <div className="flex gap-3 p-3 bg-slate-50 rounded-xl">
                  {displayImage ? (
                    <img src={displayImage} alt={produitSelectionne.nom} className="w-20 h-20 rounded-lg object-cover flex-shrink-0 border border-slate-200" />
                  ) : (
                    <div className="w-20 h-20 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0 border border-slate-200">
                      <Truck className="w-8 h-8 text-slate-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0 text-sm">
                    <p className="font-semibold text-slate-900 truncate">{produitSelectionne.nom}</p>
                    {variationKey && <p className="text-xs text-slate-500">{variationKey}</p>}
                    <p className="text-xs text-slate-600 mt-1">Quantité : <strong>{qte}</strong></p>
                    <p className="text-xs text-slate-600">Total : <strong>{formater(prixFinal * qte)}</strong></p>
                  </div>
                </div>
                <div className="text-sm space-y-1 text-slate-700">
                  <p>Client : <strong>{form.client_nom || "—"}</strong> ({form.client_telephone || "—"})</p>
                  <p>Livraison : <strong>{villeText.trim() || "—"}{quartierText.trim() ? `, ${quartierText.trim()}` : ""}</strong></p>
                  <p>Mode : <strong>{livraisonIncluse ? "Livraison incluse dans le prix" : "Livraison payée au livreur"}</strong></p>
                  <p>Commission estimée : <strong className="text-emerald-700">{formater(commission)}</strong></p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500">Aucun produit sélectionné.</p>
            )}
            <DialogFooter className="gap-2 sm:gap-2">
              <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={enCours} className="flex-1">Modifier</Button>
              <Button
                onClick={async () => { await soumettre(); setConfirmOpen(false); }}
                disabled={enCours}
                className="flex-1 bg-[#1a1f5e] hover:bg-[#141952] text-white"
              >
                {enCours ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirmer et envoyer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
