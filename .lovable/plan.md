## Problème

La migration de sécurité du 8 juin a rendu le bucket `kyc-documents` privé. Or les images des produits étaient stockées dans ce même bucket avec des URLs `…/public/kyc-documents/…`. Résultat : toutes les images produits sont cassées côté admin, vendeur, catalogue, démo et partage WhatsApp.

## Solution

Créer un bucket public dédié `product-images`, y migrer les fichiers images référencés dans `produits.images` et `produits.variations`, mettre à jour les URLs en base, et pointer les futurs uploads produits vers ce nouveau bucket.

## Étapes

1. **Créer le bucket public `product-images`** (lecture anonyme autorisée, écriture admin uniquement via policies sur `storage.objects`).

2. **Edge Function `migrate-product-images`** (exécutée une fois) :
   - Liste tous les `produits.images[]` + `produits.variations[].options[].image_url` qui pointent vers `kyc-documents/…`.
   - Pour chaque fichier : `storage.from('kyc-documents').download()` puis `storage.from('product-images').upload()` (même nom).
   - Construit la nouvelle URL publique `…/public/product-images/<nom>`.
   - `UPDATE produits` : remplace l'ancienne URL par la nouvelle dans `images` et `variations` (JSONB).
   - Retourne un récap (nombre de fichiers copiés, produits mis à jour, erreurs).
   - Protection : auth admin requise (`has_role(auth.uid(),'admin')`).

3. **Mettre à jour les uploads produits** dans `src/components/produits/DialogProduit.jsx` (et tout autre uploader produit) pour cibler `product-images` au lieu de `kyc-documents`.

4. **Vérifications** :
   - Lancer l'Edge Function depuis la console admin (bouton temporaire) ou directement via `supabase.functions.invoke`.
   - Contrôler 2-3 produits côté admin, vendeur catalogue, page détail.
   - `bunx vitest run` pour confirmer absence de régression.

## Détails techniques

- Les fichiers KYC réels (`kyc/<vendeur_id>/…`) ne sont **pas** touchés : le script filtre uniquement les chemins effectivement listés dans `produits.images`/`variations`.
- Le bucket `kyc-documents` reste privé — sécurité KYC préservée.
- Les anciens fichiers dans `kyc-documents` ne sont pas supprimés (copie, pas déplacement) pour permettre un rollback si besoin.
- Aucun changement de schéma — seules les valeurs JSONB sont réécrites.

## Fichiers impactés

- `supabase/functions/migrate-product-images/index.ts` (nouveau)
- Migration SQL : policies `storage.objects` pour `product-images`
- `src/components/produits/DialogProduit.jsx` (ciblage bucket upload)
- Bouton admin temporaire dans `src/pages/Produits.jsx` pour déclencher la migration
