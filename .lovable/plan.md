## Problème
Côté admin (DialogProduit), le champ Description est un `<Input>` (une seule ligne) — impossible de saisir des paragraphes. Côté vendeur (ProduitDetail), l'affichage respecte déjà les retours à la ligne (`whitespace-pre-line`) mais le bloc peut être amélioré visuellement.

## Changements (UI uniquement, aucune logique)

### 1. `src/components/produits/DialogProduit.jsx` (ligne 313)
Remplacer le `<Input>` mono-ligne par un `<Textarea>` multi-lignes :
- import `Textarea` depuis `@/components/ui/textarea`
- `rows={6}`, `min-h-[140px]`, `resize-y`
- placeholder : « Description détaillée du produit. Utilisez Entrée pour créer des paragraphes. »
- Les retours à la ligne (`\n`) saisis seront conservés tels quels en BDD (colonne `description` TEXT déjà existante, aucune migration).

### 2. `src/pages/ProduitDetail.jsx` (lignes 222-227)
Améliorer le rendu de la description vendeur :
- Garder `whitespace-pre-line` (préserve les paragraphes)
- Élargir : `p-5` au lieu de `p-4`, `text-[15px]`, `leading-7`
- Découper le texte sur `\n\n` et rendre chaque paragraphe dans un `<p>` séparé avec `mb-3 last:mb-0` pour un espacement propre entre paragraphes
- Idem pour le bloc « Détails » (ligne 230-235) pour cohérence

## Hors scope
- Pas de changement de schéma DB
- Pas de markdown / éditeur riche (texte brut + paragraphes uniquement)
- Aucune modification de la logique produits, prix, stocks, RLS