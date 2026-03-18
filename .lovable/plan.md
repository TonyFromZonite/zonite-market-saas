
# Plan: Order Lifecycle — Stock, Commissions, Stats

## Current State
- **Order creation** (NouvelleCommandeVendeur): Already deducts stock ✅
- **Admin status change** (GestionCommandes): Only updates status text + sends notification — **no business logic** for delivery success/failure
- **Returns** (RetoursAdmin): Already handles stock restoration + commission deduction ✅

## What's Missing (Root Cause)
The `sauvegarder()` function in `GestionCommandes.jsx` updates the status field but does NOT trigger any business logic when transitioning to `livree` or `echec_livraison`.

## Changes — Single File: `src/pages/GestionCommandes.jsx`

Enhance `sauvegarder()` to handle three critical transitions:

### 1. Status → `livree` (Delivery Success)
- Insert a `ventes` record (vendeur_id, produit_id, quantite, montant_total, commission_vendeur, profit_zonite, semaine/mois/annee)
- Commission = `(prix_final_client - prix_unitaire) × quantite`
- Profit Zonite = `montant_total - commission_vendeur - (prix_achat × quantite)`
- Credit seller's `solde_commission` and increment `total_commissions_gagnees`
- Record `mouvements_stock` entry (type: `sortie`, confirms the reservation)
- Add `date_livraison_effective` to order

### 2. Status → `echec_livraison` (Delivery Failed)
- Restore stock to the coursier's warehouse in `produits.stocks_par_coursier`
- Update `produits.stock_global`
- Record `mouvements_stock` entry (type: `entree`, stock restored)

### 3. Status → `annulee` (Cancelled)
- Same stock restoration logic as `echec_livraison`

### Helper Functions (inside GestionCommandes.jsx)
- `handleLivree(commande)` — fetches product + seller, calculates commission, inserts vente, updates seller balance
- `handleEchecOrAnnulee(commande)` — fetches product, restores stock to coursier, records movement

### No Other Files Changed
- `adminApi.jsx` — already has all needed methods
- `NouvelleCommandeVendeur.jsx` — stock deduction already works
- `RetoursAdmin.jsx` — return flow already works
- No DB migrations needed — all tables exist

## Technical Detail

```text
sauvegarder() flow:
  1. Update commande status (existing)
  2. IF nouveauStatut === "livree"
     → fetch produit (prix_achat, prix_vente)
     → fetch seller (solde_commission, taux_commission)
     → calculate commission & profit
     → insert into ventes
     → update seller balance
     → set date_livraison_effective
  3. IF nouveauStatut === "echec_livraison" OR "annulee"
     → fetch produit (stocks_par_coursier)
     → restore stock for coursier_id + variation
     → update stock_global
     → insert mouvements_stock (entree)
  4. Send notification (existing)
  5. Audit log (existing)
```
