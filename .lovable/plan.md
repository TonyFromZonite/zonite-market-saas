## Objectif

Rendre la disponibilité d'une variation **dépendante du coursier / ville / quartier** de livraison, pas seulement du stock global produit.

## Constat

Aujourd'hui dans `variationHelpers.js`, `getOptionStock(produit, varName, value)` **additionne le stock de toutes les agences**. Donc :
- Côté `ProduitDetail.jsx`, `CatalogueVendeur.jsx`, `NouvelleCommandeVendeur.jsx`, une couleur/taille apparaît "disponible" même si elle n'existe que chez un coursier d'une autre ville.
- Seul `SelecteurLocalisation.jsx` (utilisé dans la vente directe admin) calcule déjà par coursier.

L'écran admin `DialogProduit.jsx` permet bien d'éditer `stocks_par_coursier[*].stock_par_variation[*].quantite` par coursier — le modèle de données est donc correct, c'est uniquement la **lecture côté vendeur** qui ne segmente pas.

## Changements (frontend uniquement, aucune migration SQL)

### 1. `src/lib/variationHelpers.js`
Ajouter deux helpers, sans casser l'API actuelle :
- `getOptionStockInCoursiers(produit, varName, value, coursierIds)` — comme `getOptionStock` mais filtré sur un `Set` de `coursier_id`. Si `coursierIds` est `null`/`undefined`, retombe sur le comportement global existant.
- `isOptionAvailableInCoursiers(produit, varName, value, coursierIds)` — booléen équivalent.
- Helper utilitaire `getCoursierIdsForVille(coursiers, zonesLivraison, quartiers, villeId, quartierId?)` qui renvoie le `Set` des coursiers couvrant une ville (via `ville_id` direct) ou un quartier (via `zones_livraison.quartiers_ids` + `coursiers.zones_livraison_ids`). Si `quartierId` fourni, restreindre aux coursiers couvrant ce quartier exact.

### 2. `src/pages/NouvelleCommandeVendeur.jsx`
- Calculer `coursierIdsForLocation` à partir de `matchedVille` (+ `matchedQuartier` quand connu), via le nouveau helper.
- Dans les deux `v.options.map(...)` (lignes ~459 et ~483), remplacer `isOptionAvailable(produitSelectionne, v.nom, opt.value)` par `isOptionAvailableInCoursiers(produitSelectionne, v.nom, opt.value, coursierIdsForLocation)` **dès qu'une ville est saisie**. Tant qu'aucune ville n'est saisie, garder le comportement actuel (global) pour ne pas bloquer la sélection préalable.
- Afficher le badge "Rupture dans {ville}" plutôt que "Rupture" générique quand le filtre est actif.
- Le `stockInCity` existant (lignes 170-199) continue d'agir comme garde finale au submit — inchangé.

### 3. `src/pages/ProduitDetail.jsx`
- Récupérer `coursiers`, `zones_livraison`, `quartiers`, `villes` via `useQuery`.
- Lire la ville/quartier du vendeur depuis `compteVendeur` (`session` → table `sellers` → `ville`, `quartier`).
- Calculer `coursierIdsForVendeur` et passer aux appels `isOptionAvailable` (lignes 179 et 215). Si le vendeur n'a pas de ville renseignée, fallback global.
- Afficher sous chaque option image en rupture locale : `Indisponible à {ville}` au lieu de juste "Rupture".

### 4. `src/pages/CatalogueVendeur.jsx`
- Même approche : utiliser la ville du vendeur pour filtrer les vignettes couleurs (lignes 317, 353, 354). Fallback global si pas de ville.

### 5. Tests — `src/test/audit-05-produits.test.ts`
Ajouter 3 cas :
- Une option présente uniquement chez coursier A est **disponible** quand `coursierIds = {A}`, **indisponible** quand `coursierIds = {B}`.
- Une option dont le stock est 0 chez tous les coursiers d'une ville est indisponible même si elle existe dans une autre ville.
- `getCoursierIdsForVille` renvoie l'union (coursiers via `ville_id` + coursiers via `zones_livraison_ids` couvrant un quartier de la ville).

## Hors scope

- Aucune modification de schéma DB, RLS, edge function ou logique de réservation/déduction de stock (toujours réservation à la création + sortie définitive à la livraison).
- `DialogProduit.jsx` (admin) inchangé : le modèle de données autorise déjà des stocks différents par coursier et par variation.
- `SelecteurLocalisation.jsx` inchangé (déjà correct).

## Fichiers touchés

- `src/lib/variationHelpers.js`
- `src/pages/NouvelleCommandeVendeur.jsx`
- `src/pages/ProduitDetail.jsx`
- `src/pages/CatalogueVendeur.jsx`
- `src/test/audit-05-produits.test.ts`
