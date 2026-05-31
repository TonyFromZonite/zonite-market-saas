## Objectif

Dans le dialogue de détail d'une commande côté admin (`/CommandesVendeurs`), indiquer clairement si le prix client inclut les frais de livraison ou non, en s'appuyant sur les champs déjà présents en base (`livraison_incluse`, `frais_livraison`).

## Changements

Fichier : `src/pages/CommandesVendeurs.jsx`, bloc récapitulatif (lignes 507-517).

1. Sous la ligne « Prix client », ajouter un badge/texte :
   - Si `commandeSelectionnee.livraison_incluse === true` → badge vert « Livraison incluse » + montant des frais (`frais_livraison`) en sous-texte.
   - Sinon → badge orange « Livraison en sus » + montant des frais à percevoir auprès du client à la livraison.
2. Ajouter une ligne dédiée « Frais de livraison » dans la grille pour afficher `formater(frais_livraison)` quand le montant est > 0.

Styling : tokens Tailwind existants (badges `bg-emerald-100/text-emerald-700` et `bg-orange-100/text-orange-700`), aucun changement de design system.

## Hors-scope

- Aucune modification de logique métier, RLS, query Supabase ou calcul de commission.
- Aucun changement côté vendeur.

## Test

Mettre à jour `src/pages/CommandesVendeurs.test.jsx` pour vérifier l'affichage du label « Livraison incluse » / « Livraison en sus » selon `livraison_incluse` dans les données mockées.
