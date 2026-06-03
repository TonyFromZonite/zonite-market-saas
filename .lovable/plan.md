
## Objectif

Deux problèmes côté admin & vendeur, liés à la nouvelle gestion des variations enrichies (image + prix par option) :

1. **Stock non cohérent** : quand on ajoute une variation, on ne peut pas saisir directement le nombre de pièces par option, par coursier / ville / quartier, et le stock global n'est pas garanti cohérent avec la somme par coursier.
2. **Images des variations absentes de la galerie** : les images attachées aux options de la variation porteuse d'images ne s'affichent pas dans la liste d'images du produit. Elles doivent suivre l'image principale et disparaître quand l'option correspondante est en rupture (stock 0).

## Périmètre

- `src/components/produits/DialogProduit.jsx` (édition admin)
- `src/lib/variationHelpers.js` (helpers de lecture)
- `src/pages/ProduitDetail.jsx` (vue vendeur)
- `src/pages/CatalogueVendeur.jsx` (vignettes catalogue — image principale uniquement, vérification)
- Tests : `src/test/audit-05-produits.test.ts`

Aucune migration base de données : on continue d'utiliser `produits.variations` (JSONB) et `produits.stocks_par_coursier` (JSONB) existants. `stock_global` reste recalculé à partir de `stocks_par_coursier`.

---

## 1. Stock par variation cohérent (admin)

### 1.a Matrice stock directement dans l'onglet « Variations »

Sous chaque option d'une variation, ajouter une **mini-matrice "Stock par coursier"** :
- Une ligne par coursier actif, avec un input numérique (qté).
- Lecture/écriture vers `stocks_par_coursier[].stock_par_variation[]` en utilisant la `variation_key` canonique (`Nom1:Val1 / Nom2:Val2` quand plusieurs variations existent — déjà géré par `getVariationKeys`).
- Sous-total option = somme des coursiers.
- Affichage en lecture seule du sous-total ville (groupage des coursiers par `ville_id`).

L'onglet « Stock / Coursiers » existant reste disponible comme vue tableau complète, mais l'édition principale se fait désormais option par option (plus intuitif quand on ajoute une variation).

### 1.b Stock global toujours dérivé

- `stock_global` du produit = somme des `quantite` sur tout `stocks_par_coursier[].stock_par_variation[]`.
- Recalcul à chaque modification de la matrice et au save (`onSave`). Le champ n'est plus saisissable manuellement (déjà le cas).
- `stock_total` par coursier également recalculé automatiquement.

### 1.c Synchronisation des clés

Quand on renomme une option (`updateOption(..., {value})`) ou une variation, ou qu'on en supprime une :
- Mettre à jour toutes les `variation_key` dans `stocks_par_coursier` (replace / drop).
- Quand une nouvelle option est ajoutée, créer automatiquement des entrées `quantite: 0` pour chaque coursier déjà présent.
- Cela existe partiellement pour la suppression, à compléter pour rename + add option.

### 1.d Validation au save

- Bloquer la sauvegarde si une option n'a pas de nom.
- Avertissement (non bloquant) si `stock_global = 0` alors que le produit est `actif=true`.

---

## 2. Galerie produit fusionnée avec images de variation disponibles

### 2.a Helper

Dans `variationHelpers.js`, ajouter :

```js
getGalleryImages(produit, coursierIds?) -> string[]
```

Logique :
1. Démarrer avec `produit.images` (image principale en `[0]`, suivie des autres images produit).
2. Récupérer `getImageVariation(variations)`. Pour chaque option de cette variation, si `image_url` existe ET l'option est disponible (`isOptionAvailable` ou `isOptionAvailableInCoursiers` si `coursierIds` fourni), ajouter `image_url` à la suite.
3. Dédupliquer (Set sur URL) tout en préservant l'ordre.

### 2.b ProduitDetail.jsx

- Remplacer `images = produit.images || []` par `images = getGalleryImages(produit, coursierIdsForVendeur)`.
- La bande de miniatures utilise cette liste fusionnée.
- Cliquer sur une miniature d'image de variation :
  - met à jour `galleryIdx` (affichage), 
  - **et** présélectionne automatiquement l'option correspondante (`setSelected`) pour que prix & disponibilité reflètent l'image.
- Quand une option est sélectionnée via les chips couleur, faire défiler / marquer la miniature correspondante comme active.
- Retirer la condition `!(imageVar && selected[imageVar.nom])` qui masquait la bande dès qu'une option image était choisie — la bande reste visible.

### 2.c Catalogue (vérification)

`CatalogueVendeur.jsx` continue d'afficher uniquement `produit.images[0]` (vitrine). Aucune fusion là, conforme à la mémoire actuelle. À vérifier rapidement, pas de changement attendu.

---

## 3. Tests

Ajouts dans `src/test/audit-05-produits.test.ts` :

- **5.22** `getGalleryImages` : image principale puis images des options disponibles, dans l'ordre, sans doublons.
- **5.23** `getGalleryImages` : retire l'image d'une option dont le stock global est 0.
- **5.24** `getGalleryImages` avec `coursierIds` : retire l'image d'une option non disponible chez les coursiers couvrant la ville du vendeur, même si stock global > 0 ailleurs.
- **5.25** Cohérence stock : pour un produit avec 2 coursiers et 2 options, somme des `stock_par_variation.quantite` == `produit.stock_global` recalculé.
- **5.26** Renommage d'option propage la nouvelle `variation_key` dans `stocks_par_coursier` (test du helper de migration de clés extrait du dialog).

Lancer `bunx vitest run` à la fin pour valider la suite complète.

---

## Détails techniques

- Toutes les modifications de `stocks_par_coursier` passent par un helper unique `setStockForKey(stocksParCoursier, coursierId, variationKey, quantite)` (à introduire en haut du dialog), pour éviter les écritures incohérentes éparpillées.
- Recalcul `stock_global` et `stock_total` centralisé dans `recomputeTotals(stocksParCoursier)` appelé à chaque mutation.
- Les `variation_key` continuent d'utiliser `"Nom:Val"` simple si une seule variation, et `"Nom1:V1 / Nom2:V2"` pour combinaisons. La logique de matching souple existante (`split(/\s*\/\s*|\|/)`) dans `getOptionStockInCoursiers` reste valable.
- Aucun changement de schéma SQL. Aucun changement RLS.
- Aucun changement aux routes / pages publiques.

## Hors périmètre

- Pas de refonte UI globale du dialog produit.
- Pas de modification du flux de commande / réservation de stock (déjà OK avec les `variation_key`).
- Pas de changement côté `NouvelleCommandeVendeur.jsx` (consomme déjà `getOptionStock`).
