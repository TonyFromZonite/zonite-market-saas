## Problème

1. Aucune UI ne permet au vendeur de choisir le mode de paiement de la livraison → `livraison_incluse` est codé en dur à `false` (lignes `NouvelleCommandeVendeur.jsx:254` et `NouvelleVente.jsx:53`).
2. Le calcul de commission ne tient pas compte de `livraison_incluse` : actuellement `commission = (prix_final - prix_gros) × qte` dans tous les cas (`GestionCommandes.jsx:208`, `CommandesVendeurs.jsx:170`).

## Logique métier cible

- **Livraison incluse dans le prix** : `commission = (prix_final − prix_gros − frais_livraison ) × qte`
- **Client paie au livreur** : `commission = (prix_final − prix_gros) × qte` (inchangé)

`frais_livraison = commandes_vendeur.frais_livraison` stocke le total estimé/confirmé pour la commande). 

## Changements

### 1. UI vendeur — `src/pages/NouvelleCommandeVendeur.jsx`

- Ajouter `mode_paiement_livraison: "separe"` à `form` initial.
- Avant le bloc « Résumé », ajouter une carte avec deux options sélectionnables :
  - **Le client paie la livraison au livreur** (défaut) — petit texte explicatif : « Le client règle séparément les frais au livreur à la réception. »
  - **Les frais de livraison sont inclus dans le prix** — texte : « Le prix affiché au client comprend déjà la livraison. Les frais seront déduits de votre commission. »
- À l'insert (ligne 254) : `livraison_incluse: form.mode_paiement_livraison === "inclus"`.
- Mettre à jour le bloc Résumé : si inclus → afficher « Livraison : incluse dans le prix » et indiquer la commission estimée nette ; sinon → « À régler au livreur : X FCFA ».

### 2. UI admin — `src/components/vente/FormulaireVente.jsx` + `src/pages/NouvelleVente.jsx`

- Ajouter le même toggle dans `FormulaireVente.jsx` (champ `livraison_incluse` dans `donnees`, défaut `false`).
- Propager via `onSubmit` jusqu'à l'insert dans `NouvelleVente.jsx` (remplacer `livraison_incluse: false` par la valeur du formulaire).

### 3. Calcul commission — `src/pages/GestionCommandes.jsx` (ligne 208) et `src/pages/CommandesVendeurs.jsx` (ligne 170)

Remplacer le calcul actuel par :

```js
const fraisLivraison = Number(commande.frais_livraison) || 0;
const livraisonIncluse = !!commande.livraison_incluse;
const baseCommissionUnitaire = livraisonIncluse
  ? (prixFinalClient - prixGros - (fraisLivraison / Math.max(1, quantite)))
  : (prixFinalClient - prixGros);
const commissionVendeur = Math.max(0, baseCommissionUnitaire * quantite);
```

La marge ZONITE reste `(prix_gros − prix_achat) × qte` (les frais de livraison ne sont jamais à la charge de ZONITE).

### 4. Affichage — `src/pages/GestionCommandes.jsx`

- Vérifier/ajouter un badge `Livraison incluse` dans la fiche commande quand `livraison_incluse === true`. Aucun changement de logique d'affichage des montants.

### 5. Notification vendeur (déjà dans `GestionCommandes.jsx` ligne 256+)

- Mentionner « Frais livraison déduits : X FCFA » dans le message quand `livraison_incluse === true`, pour que le vendeur comprenne le calcul.

## Hors scope

- Aucune migration DB (champ `livraison_incluse` existe déjà).
- Pas de changement sur la marge ZONITE, l'assignation coursier, ni le calcul des frais de livraison eux-mêmes.
- Pas de modification des données historiques (anciennes ventes conservent leur commission déjà calculée).