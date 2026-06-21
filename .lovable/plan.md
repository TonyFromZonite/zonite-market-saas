## Objectif
Confirmer que **tout vendeur** peut soumettre son KYC depuis `/ResoumissionKYC` sans rencontrer « Modification non autorisée » ni autre blocage, quel que soit son statut de départ (`non_soumis`, `rejete`, `en_attente`, NULL).

## État actuel observé
- 688 vendeurs en `active_seller / non_soumis`, 4 en `kyc_rejected / rejete`, 4 en `pending_verification / non_soumis`, 1 en `kyc_pending / en_attente` — tous éligibles à soumettre.
- Frontend `ResoumissionKYC.jsx` envoie : `kyc_document_*_url`, `kyc_selfie_url`, `kyc_passeport_url`, `kyc_type_document`, `kyc_document_type`, `statut_kyc='en_attente'`, `seller_status='kyc_pending'`, `kyc_raison_rejet=null`, `kyc_submitted_at`.
- Trigger `prevent_seller_privileged_updates` autorise déjà la transition self-service `statut_kyc → en_attente` + `seller_status → kyc_pending`.
- Trigger `check_kyc_documents` valide la présence des docs (CNI: recto+verso+selfie ; Passeport: passeport+selfie).
- RLS UPDATE `Users update own seller` : `auth.uid() = user_id` (USING + WITH CHECK).

## Plan de vérification (lecture seule — aucune modif code/DB)

### 1. Audit RLS & triggers
Confirmer via `supabase--read_query` :
- Liste des triggers actifs sur `public.sellers` (ordre d'exécution).
- Aucun champ envoyé par le frontend n'est dans la liste bloquée du trigger `prevent_seller_privileged_updates` (hors `statut_kyc` et `seller_status` qui sont allowlistés en self-submit).
- Politique RLS `Users update own seller` couvre bien tous les vendeurs (= chacun a un `user_id` non NULL lié à `auth.users`).
- Détecter d'éventuels vendeurs avec `user_id IS NULL` (qui échoueraient en RLS) — produire la liste.

### 2. Simulation SQL avec rôle `authenticated`
Pour chaque combinaison de statut initial (`non_soumis`, `rejete`, `en_attente`, NULL), simuler dans une transaction annulée (`BEGIN; ... ROLLBACK;`) :
```text
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '<user_id du vendeur cible>';
UPDATE sellers SET statut_kyc='en_attente', seller_status='kyc_pending', ...;
```
Et vérifier qu'aucune exception `insufficient_privilege` n'est levée. Tester un échantillon de vendeurs de chaque bucket actuel.

### 3. Test E2E navigateur
- Ouvrir le preview, se connecter avec un vendeur en `non_soumis` (active_seller) puis un en `rejete`.
- Naviguer vers `/ResoumissionKYC`, uploader 3 docs CNI factices, soumettre.
- Vérifier : toast succès + transition DB vers `en_attente` + insertion `notifications_admin`.
- Capturer logs console + réseau pour repérer toute 401/403/4xx ou message « Modification non autorisée ».

### 4. Rapport final
Livrer un récap clair :
- ✅ / ❌ par statut initial.
- Liste des vendeurs « à risque » (user_id NULL ou incohérence email/auth) s'il y en a, avec recommandation de correctif ciblé (sans modifier le code aujourd'hui).
- Confirmation explicite que le message « Modification non autorisée… » ne peut plus apparaître pour une soumission KYC standard.

## Hors périmètre
- Aucun changement de schéma, RLS, trigger, ou frontend dans ce plan. Si l'audit révèle un cas cassé, je proposerai une 2ᵉ étape de correctif ciblé après ton accord.