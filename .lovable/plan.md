# Problème identifié

Quand un vendeur termine la formation et clique sur « Terminer et accéder au catalogue », le code (`VideoFormation.jsx`, ligne 141) fait :

```js
supabase.from('sellers').update({
  training_completed: true,
  catalogue_debloque: true,
  conditions_acceptees: true,
  training_completed_at: ...
}).eq('id', compteVendeur.id)
```

Mais le trigger Postgres `prevent_seller_privileged_updates` bloque explicitement toute modification de ces 3 colonnes (`training_completed`, `catalogue_debloque`, `conditions_acceptees`) par un utilisateur non-admin → l'update échoue avec `Modification non autorisée : ces champs sont réservés à l'administration.`

Résultat côté vendeur : la formation ne se valide jamais, le catalogue reste verrouillé, même après avoir coché les cases.

C'est une régression provoquée par le trigger de sécurité (ajouté pour empêcher l'escalade de privilèges), qui est trop strict pour le cas légitime de l'auto-complétion de formation par le vendeur.

# Correction (chirurgicale, rien d'autre touché)

## 1. Nouvelle Edge Function `complete-training`
Fichier : `supabase/functions/complete-training/index.ts`

- Auth via JWT du vendeur connecté (`Authorization: Bearer <token>`)
- Récupère `user.id` depuis `supabase.auth.getUser()`
- Avec le client **service_role** (bypass trigger), met à jour la ligne `sellers` correspondante :
  - `training_completed = true`
  - `catalogue_debloque = true`
  - `conditions_acceptees = true`
  - `training_completed_at = now()`
- N'autorise QUE ces 4 champs, et seulement pour le seller lié à `user.id` → aucune surface d'escalade
- Retourne `{ ok: true, seller: {...} }`
- CORS standard, pas de `verify_jwt = false` (auth requise)

## 2. `src/pages/VideoFormation.jsx` — `handleTerminer`
Remplacer l'`update` direct par un appel à l'edge function via `supabase.functions.invoke('complete-training')`. En cas de succès, garder le comportement existant (mise à jour `localStorage`, toast, redirection vers `CatalogueVendeur`). Le reste du fichier (timer, vidéo, checkboxes, UI) n'est pas modifié.

## Hors-périmètre (non touché)
- Trigger `prevent_seller_privileged_updates` : conservé tel quel (sécurité).
- RLS `sellers` : inchangée.
- `CatalogueVendeur.jsx`, `FormationCours.jsx`, `WelcomeWizard.jsx`, `SellerStatusEngine.jsx` : inchangés.
- Aucune autre logique vendeur/admin/KYC modifiée.

## Vérification
- Test manuel : un vendeur termine la formation → catalogue accessible.
- Lancer la suite Vitest (en particulier `audit-03-formation-catalogue.test.ts`) — aucun changement de comportement attendu côté logique d'accès.
- `supabase--edge_function_logs complete-training` pour confirmer le succès.
