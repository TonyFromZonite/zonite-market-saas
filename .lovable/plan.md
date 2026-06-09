## Problème
Quand un nom de produit est long, il est tronqué (`truncate`) ou reste sur une seule ligne, ce qui le rend illisible côté admin et vendeur.

## Changements (UI uniquement, aucune logique)

### 1. `src/pages/ProduitDetail.jsx` (ligne 148) — header détail produit
- Remplacer `truncate` par un wrap multi-lignes :
  `className="text-base font-bold leading-tight break-words"` (suppression de `truncate`).
- Le header reste sticky, le titre peut s'étaler sur 2 lignes si besoin.

### 2. `src/pages/Produits.jsx` (ligne 320) — tableau admin
- Remplacer `<span className="font-medium">{p.nom}</span>` par :
  `<span className="font-medium whitespace-normal break-words leading-snug">{p.nom}</span>`
- Ajouter `align-top` sur la `TableCell` parente et un `min-w-0` sur le wrapper flex pour permettre le retour à la ligne dans la cellule.

### 3. `src/pages/CatalogueVendeur.jsx` (ligne 372) — carte produit vendeur
- Déjà en `leading-tight` sans `truncate`, mais ajouter `break-words` pour gérer les mots très longs : 
  `className="font-semibold text-slate-900 text-sm leading-tight break-words"`.

## Hors scope
- Aucun changement de schéma, de logique métier, de RLS, ni de description.
- Pas de modification des autres titres tronqués volontairement (variations, options, retours) qui ont leur propre contrainte d'affichage compact.
