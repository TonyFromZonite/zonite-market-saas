## Problème confirmé en base

- **60 utilisateurs `auth.users` orphelins** : compte Supabase Auth créé, mais aucune ligne `sellers` (ni rôle admin). Le vendeur ne peut plus se réinscrire (« email déjà enregistré ») et ne peut pas se connecter (« Profil vendeur introuvable »).
- **31 lignes `sellers` avec `email_verified=false`** datant de plus d'1 jour : la fiche existe, l'admin voit « non vérifié », mais le vendeur n'a jamais reçu/saisi son OTP et reste bloqué.

## Cause racine

Le flux actuel de `InscriptionVendeur.jsx` enchaîne 5 opérations côté client (`auth.signUp` → `signInWithPassword` → `INSERT sellers` → `INSERT user_roles` → invocation OTP). Chaque étape peut échouer indépendamment et laisser un état partiel. Aucun rollback, aucune idempotence, envoi OTP en `try/catch` silencieux.

## Solution

Tout déplacer dans **une seule edge function `register-seller`** exécutée en `service_role`, transactionnelle, avec rollback si l'OTP ne part pas. Ajout d'outils admin pour reprendre/nettoyer les comptes existants.

### 1. Edge function `supabase/functions/register-seller/index.ts`

Entrée : `{ full_name, username, email, password, parraine_par? }`. Validation Zod stricte.

Logique :
1. Vérifier unicité `username` et `email` dans `sellers` via service_role.
2. **Reprise** : si `sellers.email` existe avec `email_verified=false` → régénérer OTP, `UPDATE sellers`, invoquer `send-verification-email`, renvoyer `{ resumed: true, seller_id }`. (Mot de passe non touché.)
3. **Nouveau compte** :
   - `auth.admin.createUser({ email, password, email_confirm: true })` — pas de mail Supabase, notre OTP fait foi.
   - `INSERT sellers` complet (`seller_status='pending_verification'`, OTP + expiration 24 h, `code_parrainage` dérivé du username).
   - `INSERT user_roles` (`role='vendeur'`).
   - Invoquer `send-verification-email`. **Si échec → rollback** : `DELETE user_roles` + `DELETE sellers` + `auth.admin.deleteUser`, renvoyer 502.
4. Sur erreur Postgres `23505` (unique violation), renvoyer 409 avec le champ concerné.

CORS standard, `verify_jwt = false`, logs structurés.

### 2. Refactor `src/pages/InscriptionVendeur.jsx`

- `handleRegister` n'appelle plus que `supabase.functions.invoke('register-seller', ...)`.
- Suppression des 5 appels client (`auth.signUp`, `signInWithPassword`, inserts directs, invocation OTP manuelle).
- Si réponse `resumed=true` → message « Un nouveau code vient d'être envoyé » et passage direct à l'étape 2.
- Étape 2 (saisie OTP) et `validerCode` inchangés (RLS « Users update own seller » déjà OK).
- `renvoyerCode` continue d'appeler `send-verification-email` directement.

### 3. Edge function `supabase/functions/cleanup-unverified-account/index.ts`

- Entrée : `{ email }` (un compte) **ou** `{ purge_all: true }` (tous les bloqués).
- Garde : JWT requis, l'appelant doit avoir `role='admin'` dans `user_roles` (via service_role).
- Pour chaque email cible :
  - Refuse si compte vérifié ou si l'utilisateur a `role` admin/sous_admin.
  - `DELETE` `user_roles`, `sellers`, puis `auth.admin.deleteUser`.
  - Loggue dans `journal_audit` (`action='cleanup_unverified_account'`).
- En mode `purge_all` : sélectionne tous les `auth.users` sans `sellers` ni rôle admin **et** toutes les `sellers` avec `email_verified=false`. Renvoie `{ deleted_count, errors }`.
- Protège explicitement `Tonykodjeu@gmail.com` (memory : ne jamais supprimer).

### 4. Bouton admin dans `src/pages/Vendeurs.jsx`

- Bouton « 🧹 Purger comptes non vérifiés » (badge avec le compte actuel : `60 orphelins + 31 non vérifiés`).
- Modal de confirmation listant le nombre exact (récupéré via une requête simple côté admin) et avertissant que l'opération est irréversible.
- Au clic : invocation de `cleanup-unverified-account` avec `{ purge_all: true }`, toast de résultat, refresh de la liste.
- Action supplémentaire par ligne « non vérifié » : « Renvoyer le code » (invocation `send-verification-email` après régénération de l'OTP via update direct, admin RLS le permet déjà).

### 5. Configuration auth Supabase

Via `supabase--configure_auth` : confirmer `auto_confirm_email=true` (on crée déjà les comptes avec `email_confirm:true` côté admin API, et notre OTP custom gère la vérification métier). Ne pas toucher aux autres flags.

## Détails techniques

- `service_role` via `Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")`.
- Aucun changement de schéma `sellers`/`user_roles`.
- Mémoire à mettre à jour : `mem://logic/vendor-verification-flow` pour refléter le passage via edge function atomique.

## Vérification après build

1. Inscription nominale → 1 ligne `auth.users` + 1 `sellers` + 1 `user_roles`, OTP reçu.
2. Inscription avec email déjà non vérifié → `resumed=true`, nouveau code, pas de duplicat.
3. Simulation d'échec OTP → aucune ligne en base.
4. Login compte non vérifié → redirection vers étape 2 (inchangé).
5. Bouton admin « Purger » → les 60 + 31 comptes disparaissent, compteur passe à 0, `Tonykodjeu@gmail.com` intact.
