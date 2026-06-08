## Objectif

Restaurer l'affichage des images produits côté admin, vendeur, catalogue anonyme et partage WhatsApp, **sans rendre aucun bucket public** et **sans toucher au flux KYC**.

## Solution : Edge Function `serve-product-image`

Une fonction publique (`verify_jwt = false`) qui télécharge les fichiers du bucket privé `kyc-documents` avec la `service_role` et les renvoie en HTTP avec un long cache navigateur. Les URLs en base sont réécrites pour pointer vers cette fonction.

## Étapes

1. **Edge Function `serve-product-image`**
   - Reçoit `?path=<fichier>` (ex. `1773786712287_Lonvel.avif`)
   - Refuse tout chemin commençant par `kyc/` → protection KYC absolue
   - Refuse tout chemin contenant `..` ou `/` non autorisé
   - Télécharge depuis `kyc-documents` via service_role
   - Renvoie le binaire avec `Content-Type` détecté et `Cache-Control: public, max-age=31536000, immutable`

2. **Edge Function unique `migrate-product-image-urls`** (lancée 1 fois par admin)
   - Parcourt `produits.images[]` et `produits.variations[].options[].image_url`
   - Pour chaque URL `…/storage/v1/object/public/kyc-documents/<fichier>`, la remplace par `…/functions/v1/serve-product-image?path=<fichier>`
   - Ne touche AUCUN champ KYC (`kyc_document_recto_url`, etc.)
   - Renvoie un récap (produits mis à jour, URLs réécrites)

3. **Helper centralisé `getProductImageUrl(url)`** dans `src/lib/supabaseHelpers.js`
   - Réécrit à la volée toute URL legacy qui pointerait encore vers `…/public/kyc-documents/<fichier>` (filet de sécurité pour les enregistrements oubliés ou les caches navigateur)
   - Utilisé partout où une image produit est affichée (admin Produits, ProduitDetail, CatalogueVendeur, ShareProductModal, etc.)

4. **Uploads futurs** : la fonction `uploadFile()` continue d'écrire dans `kyc-documents` (RLS admin-only autorise l'écriture pour les admins/vendeurs avec session), mais la lecture passera désormais par le proxy. Aucun changement de bucket nécessaire.

5. **Vérifications**
   - Test manuel : 3 produits sur admin, vendeur, page détail, partage WhatsApp
   - `bunx vitest run` pour confirmer l'absence de régression
   - Test KYC complet d'un vendeur de test (upload + visualisation côté admin)

## Impact sur le KYC

**Zéro changement** sur le flux KYC :
- Bucket `kyc-documents` reste privé avec les policies actuelles (`Vendors manage own KYC files` + `Admins manage all KYC files`)
- Les chemins KYC (`kyc/<seller_id>/…`) sont **explicitement bloqués** par la fonction proxy (refus 403)
- L'upload KYC depuis `ResoumissionKYC.jsx` n'est pas touché
- Les images KYC dans `GestionKYC` continuent d'utiliser `createSignedUrl` (déjà en place via le composant `KycImage`)

## Concernant le vendeur dont le KYC est rejeté

Cette régression vient probablement du même problème : depuis le 8 juin, les URLs `…/public/kyc-documents/…` retournent 400, donc l'admin voit des **vignettes cassées** dans `GestionKYC` et rejette par défaut. Je vérifierai dans `GestionKYC.jsx` que la visualisation des documents KYC utilise bien `createSignedUrl` (pas une URL publique) et corrigerai si besoin — c'est inclus dans cette intervention.

## Fichiers impactés

- `supabase/functions/serve-product-image/index.ts` (nouveau, public, sans JWT)
- `supabase/functions/migrate-product-image-urls/index.ts` (nouveau, admin only)
- `src/lib/supabaseHelpers.js` (ajout `getProductImageUrl`)
- Composants affichant des images produits (admin Produits, CatalogueVendeur, ProduitDetail, ShareProductModal, dashboards) : remplacement `img src={url}` → `img src={getProductImageUrl(url)}`
- `src/pages/GestionKYC.jsx` : vérification + correction si une URL publique KYC y traîne encore
- Bouton temporaire admin dans `src/pages/Produits.jsx` pour déclencher la migration une fois

## Détails techniques

- Fonction proxy : `Deno.serve`, sans CORS spécial (réponse image standard)
- Service_role utilisée uniquement côté serveur, jamais exposée
- Cache 1 an + `immutable` → performance équivalente à un CDN
- Pas de modification de schéma DB, uniquement des valeurs JSONB réécrites
- Rollback possible : la migration peut être inversée en remplaçant `…/functions/v1/serve-product-image?path=` par `…/public/kyc-documents/`