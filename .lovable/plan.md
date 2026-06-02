## Objectif

Lier les images d'un produit à une variation "image" (typiquement la Couleur) pour qu'un vendeur voie immédiatement les déclinaisons disponibles, masquer celles en rupture, autoriser des prix par variation, et garantir que le stock global d'une agence soit la somme des variations (avec sortie définitive à la livraison — comportement actuel conservé).

## Modèle de données (JSONB sur `produits`, pas de nouvelle table)

Structure variations enrichie :
```
variations: [
  {
    id, nom: "Couleur",
    is_image_variation: true,
    options: [
      { value: "Rouge", image_url: "...", prix_gros, prix_achat, prix_vente_conseille },
      { value: "Bleu",  image_url: "...", prix_gros, ... }
    ]
  },
  {
    id, nom: "Taille",
    is_image_variation: false,
    options: [ { value: "M" }, { value: "L" } ]   // pas d'image, pas de prix
  }
]
```

- Une seule variation peut avoir `is_image_variation = true` (typiquement Couleur).
- Les prix par option sont **optionnels** ; si absents → fallback sur le prix produit.
- `produits.images` reste pour l'image principale (vitrine catalogue, partage).
- Pas de changement de schéma SQL : tout reste dans le JSONB `variations` (compatible existant). Migration douce côté code : les anciennes `options: ["Rouge", "Bleu"]` sont relues comme `[{value:"Rouge"}, {value:"Bleu"}]`.

## Stock

- Règle confirmée : **réservation à la création de commande + sortie définitive à la livraison** (comportement actuel, déjà dans `stockManager.js`). Aucun changement de logique.
- `stock_global` produit = somme `stocks_par_coursier[*].stock_total` (déjà calculé).
- `stock_total` par coursier = somme des `stock_par_variation[*].quantite` (déjà calculé dans `DialogProduit`). On verrouille l'UI pour empêcher la saisie manuelle d'un total divergent.
- Une option de variation est "disponible" si `Σ quantite (toutes agences) > 0` pour les `variation_key` qui contiennent cette option.

## UI Admin (`src/components/produits/DialogProduit.jsx`)

1. Onglet **Variations** : ajout d'un toggle "Cette variation porte les images" (une seule active). Pour chaque option : champ image (upload + URL) si la variation est porteuse d'images, et 3 champs prix optionnels (gros / achat / vente conseillé).
2. Onglet **Images** : libellé clarifié "Image principale du produit (vitrine catalogue)". Les images de variations sont gérées dans l'onglet Variations.
3. Onglet **Stock** : badge récap par option image (ex: "Rouge: 12, Bleu: 0") + bouton "Auto-générer entrée stock pour tous les coursiers" inchangé.

## UI Vendeur

- **`ProduitDetail.jsx`** : nouvelle section "Choisir une variation" sous l'image principale qui affiche une grille d'images cliquables (issues de la variation porteuse d'images). Cliquer change l'image affichée + pré-sélectionne la variation pour le bouton Commander. Les options dont le stock = 0 sont grisées avec badge "Rupture" et non cliquables. Si plusieurs variations (ex: Couleur+Taille), un second sélecteur (chips) apparaît pour la Taille filtré par couleur choisie.
- **`CatalogueVendeur.jsx`** : pastilles miniatures (4 max) des couleurs disponibles sous la carte produit.
- **`NouvelleCommandeVendeur.jsx` / `FormulaireVente.jsx`** : le sélecteur de variation utilise les images au lieu de simples libellés, le prix affiché reflète le prix de la variation si défini.
- **`ShareProductModal.jsx`** : le calcul de commission utilise le `prix_gros` de la variation choisie si présent.

## Migration données existantes

Aucune migration SQL. À la lecture côté client, un helper `normalizeVariations(variations)` :
- convertit `options: ["X","Y"]` → `[{value:"X"}, {value:"Y"}]`
- ajoute `is_image_variation: false` si manquant
Les anciens produits restent fonctionnels ; admin ajoute progressivement images & prix variation.

## Tests & vérification

- Build (auto).
- Vitest : ajouter 3 cas dans `audit-05-produits.test.ts` (normalisation variations, calcul stock global = Σ variations, indisponibilité d'une option si stock = 0).
- Vérifier rendu visuel `ProduitDetail` sur viewport mobile.

## Fichiers touchés

- `src/lib/variationHelpers.js` (nouveau) — `normalizeVariations`, `getOptionStock`, `getOptionPrice`, `isOptionAvailable`.
- `src/components/produits/DialogProduit.jsx` — toggle image-variation, champs image/prix par option.
- `src/pages/ProduitDetail.jsx` — sélecteur visuel de variation, image dynamique, prix dynamique.
- `src/pages/CatalogueVendeur.jsx` — pastilles couleurs disponibles.
- `src/pages/NouvelleCommandeVendeur.jsx` — sélecteur image + prix variation.
- `src/components/vente/FormulaireVente.jsx` — idem.
- `src/components/vendor/ShareProductModal.jsx` — prix gros variation.
- `src/components/ModeDemoClient.jsx` — afficher image variation sélectionnée.
- `src/test/audit-05-produits.test.ts` — +3 tests.

## Hors périmètre (à confirmer si besoin plus tard)

- Pas de nouvelle table SQL.
- Pas de changement de la logique stock (réservation/livraison) — déjà conforme.
- Pas de prix variation côté `ventes` (la vente enregistre le prix réel pratiqué, déjà OK).
