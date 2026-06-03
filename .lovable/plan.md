## Problème

Dans l'éditeur de produit (onglet Variations), cliquer sur **"+ Ajouter une option"** ne fait rien visuellement. La cause : `normalizeVariations()` (`src/lib/variationHelpers.js`) filtre toutes les options dont `value` est vide, donc la nouvelle option `{ value: "" }` ajoutée à `form.variations` est supprimée à la relecture immédiate.

## Correctif (minimal, ciblé)

**Fichier : `src/components/produits/DialogProduit.jsx`**

Remplacer l'utilisation directe de `normalizeVariations(form.variations)` par un normaliseur local qui **ne filtre pas** les options vides (nécessaire pendant l'édition). Le filtre reste appliqué côté lecture publique (catalogue, commande) puisque `normalizeVariations` n'est pas modifié.

Concrètement :
- Ajouter en haut du composant une fonction `normalizeForEditor(variations)` identique à `normalizeVariations` mais **sans** le `.filter((o) => o.value)`.
- Remplacer ligne 83 : `const variations = normalizeForEditor(form.variations || []);`

## Vérification

- Ouvrir un produit existant avec une variation Couleur (3 options).
- Cliquer "+ Ajouter une option" → un 4ᵉ champ vide apparaît.
- Saisir "Jaune" → la valeur est conservée et apparaît dans le bloc Stock par coursier.
- Le bouton 🗑️ supprime toujours correctement une option.
- Sauvegarder : la 4ᵉ couleur est bien persistée.

Aucune autre modification : pas de changement du helper partagé, pas de refactor, pas de changement du layout.
