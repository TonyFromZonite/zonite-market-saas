import React, { useState, useEffect, useMemo } from "react";
import { getVendeurSessionAsync } from "@/components/useSessionGuard";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, Loader2, ChevronLeft, AlertCircle, Truck } from "lucide-react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Badge } from "@/components/ui/badge";
import BlocageKycPending from "@/components/BlocageKycPending";
import { supabase } from "@/integrations/supabase/client";

export default function NouvelleCommandeVendeur() {
  const [compteVendeur, setCompteVendeur] = useState(null);
  const [form, setForm] = useState({
    produit_id: "", quantite: 1, prix_final_client: "",
    client_nom: "", client_telephone: "", client_adresse: "",
    notes: "",
  });
  const [villeText, setVilleText] = useState("");
  const [quartierText, setQuartierText] = useState("");
  const [showVilleSuggestions, setShowVilleSuggestions] = useState(false);
  const [showQuartierSuggestions, setShowQuartierSuggestions] = useState(false);
  const [selectedVariations, setSelectedVariations] = useState({});
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  const [succes, setSucces] = useState(false);
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

  const modifier = (champ, val) => { setForm((p) => ({ ...p, [champ]: val })); setErreur(""); };
  const produitSelectionne = produits.find((p) => p.id === form.produit_id);
  const variations = produitSelectionne?.variations || [];

  // Build variation key
  const getVariationKey = () => {
    if (variations.length === 0) return "";
    return variations.map((v) => `${v.nom}:${selectedVariations[v.nom] || ""}`).join("|");
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
  const prixGros = produitSelectionne?.prix_gros || 0;
  const prixFinal = parseFloat(form.prix_final_client) || 0;
  const commission = Math.max(0, (prixFinal - prixGros) * qte);
  const formater = (n) => `${Math.round(n || 0).toLocaleString("fr-FR")} FCFA`;

  const soumettre = async () => {
    if (!compteVendeur) return setErreur("Compte vendeur non chargé.");
    if (!form.produit_id) return setErreur("Sélectionnez un produit.");
    if (variations.length > 0 && Object.values(selectedVariations).some((v) => !v)) return setErreur("Sélectionnez toutes les variations.");
    if (!villeText.trim()) return setErreur("Renseignez la ville du client.");
    if (qte < 1) return setErreur("La quantité doit être au moins 1.");
    if (!prixFinal || prixFinal < prixGros) return setErreur(`Le prix final doit être ≥ ${formater(prixGros)}`);
    if (!form.client_nom || !form.client_telephone) return setErreur("Renseignez les informations du client.");

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
        frais_livraison: estimationLivraison ? Math.round((estimationLivraison.min + estimationLivraison.max) / 2) : 1500,
        livraison_incluse: false,
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
          <Select value={form.produit_id} onValueChange={(v) => { modifier("produit_id", v); setSelectedVariations({}); }}>
            <SelectTrigger><SelectValue placeholder="Choisir un produit" /></SelectTrigger>
            <SelectContent>
              {produits.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.nom} — Stock: {p.stock_global || 0}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Variations */}
          {produitSelectionne && variations.length > 0 && (
            <div className="space-y-2">
              {variations.map((v, idx) => (
                <div key={v.nom || idx} className="space-y-1">
                  <Label>{v.nom} *</Label>
                  <Select value={selectedVariations[v.nom] || ""} onValueChange={(val) => setSelectedVariations((prev) => ({ ...prev, [v.nom]: val }))}>
                    <SelectTrigger><SelectValue placeholder={`Choisir ${v.nom}`} /></SelectTrigger>
                    <SelectContent>
                      {v.options.map((opt) => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                    </SelectContent>
                  </Select>
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
            </div>
          )}
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
            <div className="space-y-1 text-sm">
              <p>Produit: <strong>{produitSelectionne.nom}</strong> {variationKey && `(${variationKey})`}</p>
              <p>Quantité: <strong>{qte}</strong></p>
              <p>Prix unitaire: <strong>{formater(prixFinal)}</strong></p>
              <p>Montant total: <strong>{formater(prixFinal * qte)}</strong></p>
              <p>Livraison: <strong>{villeText.trim() || "—"}{quartierText.trim() ? `, ${quartierText.trim()}` : ""}</strong></p>
              {estimationLivraison && (
                <p>Frais livraison (estimation): <strong>
                  {estimationLivraison.min === estimationLivraison.max
                    ? formater(estimationLivraison.min)
                    : `${formater(estimationLivraison.min)} — ${formater(estimationLivraison.max)}`}
                </strong></p>
              )}
              <p className="text-xs text-slate-400">Le coursier sera attribué par l'administration.</p>
            </div>
          </div>
        )}

        <Button onClick={soumettre} disabled={enCours} className="w-full h-12 bg-[#1a1f5e] hover:bg-[#141952] text-white font-bold text-base">
          {enCours ? <Loader2 className="w-5 h-5 animate-spin" /> : "Envoyer la commande →"}
        </Button>
      </div>
    </div>
  );
}
