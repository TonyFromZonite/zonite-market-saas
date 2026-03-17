import React, { useState, useEffect } from "react";
import { getVendeurSession } from "@/components/useSessionGuard";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, Loader2, ChevronLeft, AlertCircle, Truck } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Badge } from "@/components/ui/badge";
import BlocageKycPending from "@/components/BlocageKycPending";
import { filterTable } from "@/lib/supabaseHelpers";
import { supabase } from "@/integrations/supabase/client";

export default function NouvelleCommandeVendeur() {
  const [compteVendeur, setCompteVendeur] = useState(null);
  const [form, setForm] = useState({
    produit_id: "", quantite: 1, prix_final_client: "",
    client_nom: "", client_telephone: "", client_adresse: "",
    notes: "",
  });
  const [villeId, setVilleId] = useState("");
  const [quartierId, setQuartierId] = useState("");
  const [selectedVariations, setSelectedVariations] = useState({});
  const [availableCoursiers, setAvailableCoursiers] = useState([]);
  const [selectedCoursierId, setSelectedCoursierId] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  const [succes, setSucces] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    const charger = async () => {
      const session = getVendeurSession();
      if (!session) { window.location.href = createPageUrl("Connexion"); return; }
      const sellers = await filterTable("sellers", { email: session.email });
      if (sellers.length > 0) setCompteVendeur(sellers[0]);
      else setErreur("Compte vendeur introuvable");
      const params = new URLSearchParams(window.location.search);
      const produitId = params.get("produit_id");
      if (produitId) setForm((f) => ({ ...f, produit_id: produitId }));
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
  const quartiersFiltered = quartiers.filter((q) => q.ville_id === villeId);

  // Build variation key from selections
  const getVariationKey = () => {
    if (variations.length === 0) return "";
    return variations.map((v) => `${v.nom}:${selectedVariations[v.nom] || ""}`).join("|");
  };

  const variationKey = getVariationKey();

  // Find available stock for selected variation across all coursiers
  const getStockForVariation = (coursierId) => {
    if (!produitSelectionne) return 0;
    const spc = (produitSelectionne.stocks_par_coursier || []).find((s) => s.coursier_id === coursierId);
    if (!spc) return 0;
    if (!variationKey || variations.length === 0) return spc.stock_total || 0;
    const sv = (spc.stock_par_variation || []).find((v) => v.variation_key === variationKey);
    return sv?.quantite || 0;
  };

  // Find coursiers when ville changes
  useEffect(() => {
    if (!villeId || !produitSelectionne) {
      setAvailableCoursiers([]);
      setSelectedCoursierId("");
      return;
    }
    // Find zones in this ville
    const villeZones = zonesLivraison.filter((z) => z.ville_id === villeId);
    const villeZoneIds = villeZones.map((z) => z.id);
    // Find coursiers covering these zones AND having stock
    const matching = coursiers.filter((c) => {
      const coversZone = (c.zones_livraison_ids || []).some((zid) => villeZoneIds.includes(zid));
      if (!coversZone) return false;
      const stock = getStockForVariation(c.id);
      return stock > 0;
    });
    setAvailableCoursiers(matching);
    if (matching.length === 1) setSelectedCoursierId(matching[0].id);
    else setSelectedCoursierId("");
  }, [villeId, produitSelectionne?.id, variationKey]);

  const selectedCoursier = coursiers.find((c) => c.id === selectedCoursierId);
  const stockDisponible = selectedCoursierId ? getStockForVariation(selectedCoursierId) : 0;
  const qte = parseInt(form.quantite) || 1;
  const prixGros = produitSelectionne?.prix_gros || 0;
  const prixFinal = parseFloat(form.prix_final_client) || 0;
  const commission = Math.max(0, (prixFinal - prixGros) * qte);
  const fraisLivraison = selectedCoursier?.frais_livraison_defaut || 0;
  const formater = (n) => `${Math.round(n || 0).toLocaleString("fr-FR")} FCFA`;
  const villeName = villes.find((v) => v.id === villeId)?.nom || "";
  const quartierName = quartiers.find((q) => q.id === quartierId)?.nom || "";

  const soumettre = async () => {
    if (!compteVendeur) return setErreur("Compte vendeur non chargé.");
    if (!form.produit_id) return setErreur("Sélectionnez un produit.");
    if (variations.length > 0 && Object.values(selectedVariations).some((v) => !v)) return setErreur("Sélectionnez toutes les variations.");
    if (!villeId) return setErreur("Sélectionnez une ville.");
    if (!selectedCoursierId) return setErreur("Aucun coursier disponible pour cette zone.");
    if (qte < 1) return setErreur("La quantité doit être au moins 1.");
    if (qte > stockDisponible) return setErreur(`Stock insuffisant. Disponible: ${stockDisponible}`);
    if (!prixFinal || prixFinal < prixGros) return setErreur(`Le prix final doit être ≥ ${formater(prixGros)}`);
    if (!form.client_nom || !form.client_telephone) return setErreur("Renseignez les informations du client.");

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
        frais_livraison: fraisLivraison,
        livraison_incluse: false,
        client_nom: form.client_nom,
        client_telephone: form.client_telephone,
        client_ville: villeName,
        client_quartier: quartierName,
        client_adresse: form.client_adresse,
        notes: form.notes,
        reference_commande: ref,
        statut: "en_attente_validation_admin",
      }).select().single();

      if (orderError) throw orderError;

      // Deduct stock
      const updatedSPC = (produitSelectionne.stocks_par_coursier || []).map((sc) => {
        if (sc.coursier_id !== selectedCoursierId) return sc;
        const newVarStock = (sc.stock_par_variation || []).map((sv) => {
          if (sv.variation_key !== variationKey) return sv;
          return { ...sv, quantite: Math.max(0, sv.quantite - qte) };
        });
        const newTotal = newVarStock.reduce((t, v) => t + (v.quantite || 0), 0);
        return { ...sc, stock_par_variation: newVarStock, stock_total: newTotal };
      });
      const newStockGlobal = updatedSPC.reduce((t, s) => t + (s.stock_total || 0), 0);

      await supabase.from("produits").update({
        stocks_par_coursier: updatedSPC,
        stock_global: newStockGlobal,
      }).eq("id", form.produit_id);

      // Mouvement stock
      await supabase.from("mouvements_stock").insert({
        produit_id: form.produit_id,
        type: "sortie",
        quantite: qte,
        stock_avant: produitSelectionne.stock_global,
        stock_apres: newStockGlobal,
        notes: `Commande ${ref} - ${variationKey} via ${selectedCoursier?.nom}`,
        reference_id: newOrder?.id || null,
      });

      // Admin notification
      await supabase.from("notifications_admin").insert({
        titre: "🛒 Nouvelle commande",
        message: `${compteVendeur.full_name} a commandé ${qte}x ${produitSelectionne.nom} (${variationKey})`,
        type: "commande",
        vendeur_email: compteVendeur.email,
        reference_id: newOrder?.id || null,
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
          <p className="text-sm text-slate-500 mb-6">Votre commande a été transmise à l'équipe ZONITE.</p>
          <div className="space-y-3">
            <Button onClick={() => { setSucces(false); setForm((f) => ({ ...f, client_nom: "", client_telephone: "", client_adresse: "", notes: "" })); setSelectedVariations({}); setVilleId(""); setQuartierId(""); }}
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
              {variations.map((v) => (
                <div key={v.id} className="space-y-1">
                  <Label>{v.nom} *</Label>
                  <Select value={selectedVariations[v.id] || ""} onValueChange={(val) => setSelectedVariations((prev) => ({ ...prev, [v.id]: val }))}>
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
              <Input type="number" min="1" max={stockDisponible || 999} value={form.quantite} onChange={(e) => modifier("quantite", e.target.value)} />
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
            <div className="space-y-1">
              <Label>Ville *</Label>
              <Select value={villeId} onValueChange={(v) => { setVilleId(v); setQuartierId(""); }}>
                <SelectTrigger><SelectValue placeholder="Ville" /></SelectTrigger>
                <SelectContent>
                  {villes.map((v) => <SelectItem key={v.id} value={v.id}>{v.nom}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Quartier</Label>
              <Select value={quartierId} onValueChange={setQuartierId} disabled={!villeId}>
                <SelectTrigger><SelectValue placeholder="Quartier" /></SelectTrigger>
                <SelectContent>
                  {quartiersFiltered.map((q) => <SelectItem key={q.id} value={q.id}>{q.nom}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Coursier auto-selection */}
          {villeId && produitSelectionne && (
            <div className="space-y-2">
              {availableCoursiers.length === 0 ? (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                  ❌ Aucun coursier disponible avec du stock pour cette zone.
                </div>
              ) : availableCoursiers.length === 1 ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Truck className="w-4 h-4 text-emerald-600" />
                    <span className="font-medium text-emerald-800">Coursier: {availableCoursiers[0].nom}</span>
                  </div>
                  <p className="text-xs text-emerald-600 mt-1">
                    Stock: {getStockForVariation(availableCoursiers[0].id)} | Frais: {formater(availableCoursiers[0].frais_livraison_defaut)}
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  <Label>Coursier disponible *</Label>
                  <Select value={selectedCoursierId} onValueChange={setSelectedCoursierId}>
                    <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                    <SelectContent>
                      {availableCoursiers.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.nom} — Stock: {getStockForVariation(c.id)} | {formater(c.frais_livraison_defaut)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
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
        {produitSelectionne && selectedCoursierId && prixFinal > 0 && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border-2 border-[#1a1f5e]">
            <h2 className="font-semibold text-slate-900 text-sm mb-3">📋 Résumé de la commande</h2>
            <div className="space-y-1 text-sm">
              <p>Produit: <strong>{produitSelectionne.nom}</strong> {variationKey && `(${variationKey})`}</p>
              <p>Quantité: <strong>{qte}</strong></p>
              <p>Prix unitaire: <strong>{formater(prixFinal)}</strong></p>
              <p>Montant total: <strong>{formater(prixFinal * qte)}</strong></p>
              <p>Livraison: <strong>{villeName}{quartierName ? `, ${quartierName}` : ""}</strong></p>
              <p>Coursier: <strong>{selectedCoursier?.nom}</strong></p>
              <p>Frais livraison: <strong>{formater(fraisLivraison)}</strong></p>
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
