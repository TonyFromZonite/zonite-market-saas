import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShoppingCart, Loader2, AlertCircle } from "lucide-react";
import SelecteurLocalisation from "./SelecteurLocalisation";

export default function FormulaireVente({ produits, vendeurs, onSubmit, enCours }) {
  const [donnees, setDonnees] = useState({
    produit_id: "",
    vendeur_id: "",
    quantite: "",
    prix_unitaire: "",
    prix_livraison: "",
    client_nom: "",
    client_telephone: "",
    client_adresse: "",
    notes: "",
  });

  const [localisation, setLocalisation] = useState({
    ville: "", zone: "", variation: "", stockDisponible: 0, coursierId: "", coursierNom: "",
  });

  const [erreur, setErreur] = useState("");

  const produitsActifs = useMemo(() => produits.filter((p) => p.actif !== false), [produits]);
  const vendeursActifs = useMemo(() => vendeurs.filter((v) => v.seller_status === "active_seller"), [vendeurs]);

  const produitSelectionne = useMemo(() => produits.find((p) => p.id === donnees.produit_id), [donnees.produit_id, produits]);
  const vendeurSelectionne = useMemo(() => vendeurs.find((v) => v.id === donnees.vendeur_id), [donnees.vendeur_id, vendeurs]);

  const qte = parseFloat(donnees.quantite) || 0;
  const prixUnit = parseFloat(donnees.prix_unitaire) || 0;
  const prixLivraison = parseFloat(donnees.prix_livraison) || 0;
  const montantTotal = qte * prixUnit;
  const prixGros = produitSelectionne?.prix_gros || 0;
  const prixAchat = produitSelectionne?.prix_achat || 0;
  const commission = (prixUnit - prixGros) * qte;
  const profitZonite = (prixGros - prixAchat) * qte - prixLivraison;

  const modifier = (champ, valeur) => {
    setDonnees((prev) => ({ ...prev, [champ]: valeur }));
    setErreur("");
    if (champ === "produit_id") {
      const p = produits.find((pr) => pr.id === valeur);
      if (p) setDonnees((prev) => ({ ...prev, [champ]: valeur, prix_unitaire: p.prix_gros || "" }));
    }
  };

  const handleLocalisationChange = (loc) => {
    setLocalisation(loc);
    setDonnees((prev) => ({ ...prev, prix_livraison: loc.prixLivraison || prev.prix_livraison }));
    setErreur("");
  };

  const valider = () => {
    if (!donnees.produit_id) return setErreur("Sélectionnez un produit");
    if (!localisation.ville) return setErreur("Sélectionnez une ville");
    if (!localisation.coursierId) return setErreur("Sélectionnez un coursier");
    const hasVariations = (produitSelectionne?.variations || []).length > 0;
    if (hasVariations && !localisation.variation) return setErreur("Sélectionnez une variation");
    if (!donnees.vendeur_id) return setErreur("Sélectionnez un vendeur");
    if (!qte || qte <= 0) return setErreur("La quantité doit être positive");
    if (!prixUnit || prixUnit <= 0) return setErreur("Le prix unitaire doit être positif");
    if (prixUnit < prixGros) return setErreur(`Le prix de vente (${prixUnit} FCFA) doit être ≥ au prix de gros (${prixGros} FCFA)`);
    if (localisation.stockDisponible > 0 && qte > localisation.stockDisponible) {
      return setErreur(`Stock insuffisant (${localisation.stockDisponible} disponibles)`);
    }
    onSubmit({
      ...donnees,
      quantite: qte,
      prix_unitaire: prixUnit,
      prix_livraison: prixLivraison,
      montantTotal,
      coutLivraison: prixLivraison,
      commission,
      profitZonite,
      produitSelectionne,
      vendeurSelectionne,
      ville: localisation.ville,
      zone: localisation.coursierNom,
      variation: localisation.variation,
      coursierId: localisation.coursierId,
      coursierNom: localisation.coursierNom,
    });
  };

  const formater = (n) => `${Math.round(n).toLocaleString("fr-FR")} FCFA`;

  return (
    <div className="space-y-6">
      {erreur && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />{erreur}
        </div>
      )}

      <div className="space-y-5">
        {/* Produit */}
        <div className="space-y-2">
          <Label>Produit *</Label>
          <Select value={donnees.produit_id} onValueChange={(v) => modifier("produit_id", v)}>
            <SelectTrigger><SelectValue placeholder="Choisir un produit" /></SelectTrigger>
            <SelectContent>
              {produitsActifs.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.nom} — Stock: {p.stock_global || 0}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {produitSelectionne && <p className="text-xs text-slate-500">Prix de gros: {formater(produitSelectionne.prix_gros)}</p>}
        </div>

        {/* Localisation */}
        <SelecteurLocalisation produit={produitSelectionne} value={localisation} onChange={handleLocalisationChange} disabled={enCours} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Vendeur */}
          <div className="space-y-2">
            <Label>Vendeur *</Label>
            <Select value={donnees.vendeur_id} onValueChange={(v) => modifier("vendeur_id", v)}>
              <SelectTrigger><SelectValue placeholder="Choisir un vendeur" /></SelectTrigger>
              <SelectContent>
                {vendeursActifs.map((v) => (
                  <SelectItem key={v.id} value={v.id}>{v.full_name} ({v.email})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Quantité */}
          <div className="space-y-2">
            <Label>Quantité *</Label>
            <Input type="number" min="1" value={donnees.quantite} onFocus={(e) => e.target.select()} onChange={(e) => modifier("quantite", e.target.value)} placeholder="0" />
          </div>

          {/* Prix unitaire */}
          <div className="space-y-2">
            <Label>Prix de Vente (FCFA) *</Label>
            <Input type="number" min="0" value={donnees.prix_unitaire} onFocus={(e) => e.target.select()} onChange={(e) => modifier("prix_unitaire", e.target.value)} placeholder="0" />
            {produitSelectionne && <p className="text-xs text-slate-400">Minimum : {formater(prixGros)}</p>}
          </div>

          {/* Prix Livraison */}
          <div className="space-y-2">
            <Label>Prix Livraison (FCFA)</Label>
            <Input type="number" min="0" value={donnees.prix_livraison} onChange={(e) => modifier("prix_livraison", e.target.value)} placeholder="0" />
          </div>

          {/* Client */}
          <div className="space-y-2">
            <Label>Nom du Client</Label>
            <Input value={donnees.client_nom} onChange={(e) => modifier("client_nom", e.target.value)} placeholder="Nom du client" />
          </div>
          <div className="space-y-2">
            <Label>Téléphone Client</Label>
            <Input value={donnees.client_telephone} onChange={(e) => modifier("client_telephone", e.target.value)} placeholder="Numéro de téléphone" />
          </div>
          <div className="col-span-full space-y-2">
            <Label>Adresse de Livraison</Label>
            <Input value={donnees.client_adresse} onChange={(e) => modifier("client_adresse", e.target.value)} placeholder="Adresse complète" />
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <Label>Notes</Label>
          <Textarea value={donnees.notes} onChange={(e) => modifier("notes", e.target.value)} placeholder="Notes supplémentaires..." rows={2} />
        </div>

        {/* Récapitulatif */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-5 border-2 border-blue-200">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">📋 Récapitulatif</h3>
          <div className="bg-white rounded-lg p-4 mb-4 space-y-2">
            <div className="flex justify-between text-sm"><span className="text-slate-600">Produit:</span><span className="font-semibold">{produitSelectionne?.nom || "—"}</span></div>
            {localisation.variation && <div className="flex justify-between text-sm"><span className="text-slate-600">Variation:</span><span className="font-semibold">{localisation.variation}</span></div>}
            <div className="flex justify-between text-sm"><span className="text-slate-600">Coursier:</span><span className="font-semibold">{localisation.coursierNom || "—"}</span></div>
            <div className="flex justify-between text-sm"><span className="text-slate-600">Quantité:</span><span className="font-semibold">{qte || 0}</span></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-lg p-3"><p className="text-xs text-slate-500 mb-1">Montant Total</p><p className="font-bold text-lg text-blue-600">{formater(montantTotal)}</p></div>
            <div className="bg-white rounded-lg p-3"><p className="text-xs text-slate-500 mb-1">Livraison</p><p className="font-bold text-lg">{formater(prixLivraison)}</p></div>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3"><p className="text-xs text-yellow-700 mb-1">Commission Vendeur</p><p className="font-bold text-lg text-yellow-600">{formater(commission)}</p></div>
            <div className={`${profitZonite >= 0 ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"} border rounded-lg p-3`}>
              <p className={`text-xs mb-1 ${profitZonite >= 0 ? "text-emerald-700" : "text-red-700"}`}>Profit ZONITE</p>
              <p className={`font-bold text-lg ${profitZonite >= 0 ? "text-emerald-600" : "text-red-600"}`}>{formater(profitZonite)}</p>
            </div>
          </div>
        </div>

        <Button onClick={valider} disabled={enCours} className="w-full h-12 text-base bg-[#1a1f5e] hover:bg-[#141952] text-white">
          {enCours ? (<><Loader2 className="w-5 h-5 mr-2 animate-spin" />Enregistrement...</>) : (<><ShoppingCart className="w-5 h-5 mr-2" />Enregistrer la Vente</>)}
        </Button>
      </div>
    </div>
  );
}
