## Objectif
Quand un admin clique sur l'œil pour voir une commande dans `CommandesVendeurs.jsx`, afficher la vignette du produit dans le dialogue de détail (actuellement absente).

## Changements dans `src/pages/CommandesVendeurs.jsx`

1. **Ligne 46** — Étendre le `select` Supabase pour inclure `images` du produit :
   ```
   .select("*, sellers!...(full_name), produits!...(prix_gros, images)")
   ```

2. **Dialogue détail (lignes 487–510)** — Ajouter une vignette `w-20 h-20` (image ronde/arrondie) en haut du contenu, juste après le `DialogHeader`. Source : premier élément de `commandeSelectionnee.produits?.images` (tableau JSONB). Fallback : icône `Truck` ou `Package` sur fond gris si aucune image. Lazy loading (`loading="lazy"`).

3. Aucune modif backend, RLS ou logique métier — uniquement présentation.

## Vérification
- Tests Vitest (114) doivent rester verts
- Build doit réussir
