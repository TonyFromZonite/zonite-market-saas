## Objectif

Lorsque le vendeur a choisi un produit + une (ou plusieurs) variation(s), et qu'il saisit ensuite la ville/quartier du client, afficher un **message rouge bien visible** dès qu'une des variations actuellement sélectionnées n'est pas disponible chez les coursiers couvrant cette localisation, en listant les **options disponibles** pour la même variation (ex: « ❌ La couleur **Rouge** n'est pas disponible à **Douala**. Disponibles : **Bleu**, **Vert**. »).

Le bouton "Envoyer la commande" reste bloqué tant qu'au moins une variation sélectionnée est indisponible localement.

## Fichier modifié

`src/pages/NouvelleCommandeVendeur.jsx` uniquement (logique UI + validation côté vendeur). Pas de modif backend, pas de SQL, pas de changement des helpers.

## Détails techniques

1. **Nouveau memo `variationsIndispo`** calculé après `coursierIdsForLocation` et `selectedVariations` :
   - Si pas de produit, pas de variations, pas de ville matchée → `[]`.
   - Pour chaque variation `v` du produit dont une option est sélectionnée :
     - Vérifier `isOptionAvailableInCoursiers(produit, v.nom, selectedValue, coursierIdsForLocation)`.
     - Si indisponible : récupérer la liste des `opt.value` disponibles via `isOptionAvailableInCoursiers` pour chaque option.
     - Pousser `{ varName, selected, disponibles: [...] }`.

2. **Bloc d'alerte rouge** rendu juste sous la section "Livraison" (après le bloc `stockInCity`) quand `variationsIndispo.length > 0` :
   - Icône `AlertCircle`, fond `bg-red-50 border-red-200 text-red-700`.
   - Pour chaque entrée : phrase « La **{varName}** "*{selected}*" n'est pas disponible à **{ville}**{quartier ? `, ${quartier}` : ''}. »
   - Sous-ligne : si `disponibles.length > 0` → « Disponibles : *liste*. » sous forme de **chips cliquables** qui font `setSelectedVariations(prev => ({...prev, [varName]: value}))` (réutiliser le style des chips existants).
   - Sinon → « Aucune autre option n'est disponible dans cette ville. Choisissez une autre ville/quartier. »

3. **Validation `soumettre`** : ajouter en tête de la validation stock un check :
   ```js
   if (matchedVille && variationsIndispo.length > 0) {
     return setErreur("Une ou plusieurs variations sélectionnées ne sont pas disponibles dans cette ville. Choisissez une variation disponible.");
   }
   ```

4. **Comportement existant conservé** : les options déjà désactivées/grisées dans le sélecteur de variations (via `isOptionAvailableInCoursiers`) restent en place ; le nouveau bloc agit comme une alerte synthétique + suggestion explicite, utile quand la sélection a été faite **avant** la saisie de la ville (cas du `prefilledProduct` ou clic depuis le catalogue).

## Hors scope

- Pas de changement de `SelecteurLocalisation.jsx` (admin) ni de la fiche produit publique.
- Pas de modification de `variationHelpers.js` (les helpers existants suffisent).
- Pas de nouveau test (existant déjà couvert ; un test ciblé pourra être ajouté ensuite si demandé).
