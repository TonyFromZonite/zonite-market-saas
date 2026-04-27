# Sécuriser la vérification email vendeur

## Problème constaté

Un vendeur (`ramzydivane9@gmail.com`) existe avec `email_verified=false` mais a pourtant un `seller_status=kyc_rejected` (donc a accédé à l'espace vendeur, soumis un KYC, etc.). Cela vient de plusieurs failles :

1. **Aucun garde au login** : `Connexion.jsx` connecte le vendeur sans vérifier `email_verified`.
2. **Garde dashboard incomplet** : `EspaceVendeur.jsx` bloque uniquement `seller_status === pending_verification`. Dès qu'un statut change (manuellement par admin, ou via un autre flux), l'accès est ouvert même sans email vérifié.
3. **Pas de bouton "Vérifier mon email" réellement fonctionnel** dans `ProfilVendeur.jsx` (l'utilisateur dit qu'il existe et ne fait rien — il est absent ou cassé).
4. **Inscription interruptible** : si l'utilisateur ferme l'onglet entre l'étape 1 (compte créé) et l'étape 2 (saisie du code), le compte vendeur reste créé avec `email_verified=false` et redevient orphelin.

## Plan d'action

### 1. Bloquer le login si email non vérifié — `src/pages/Connexion.jsx`
Après `signInWithPassword` et récupération du `seller`, si `seller.email_verified === false` :
- Ne PAS créer la session vendeur ni rediriger
- Régénérer un nouveau code 6-chiffres + expiration 24h, l'enregistrer dans `sellers`, appeler l'edge function `send-verification-email`
- Rediriger vers `/InscriptionVendeur?verify=1&seller_id=...` (ou afficher un modal inline) pour saisir le code reçu
- Afficher un message clair : *"Votre email n'est pas vérifié. Un nouveau code vient d'être envoyé à X."*

### 2. Renforcer le garde du dashboard vendeur — `src/pages/EspaceVendeur.jsx`
Modifier la condition (ligne 426) pour bloquer aussi tout compte avec `email_verified === false`, peu importe le `seller_status` :
```
if (!compteVendeur.email_verified || seller_status === PENDING_VERIFICATION) → écran de vérification
```
L'écran proposera deux actions : **"Renvoyer le code"** et **"Saisir le code reçu"** (champ OTP inline qui appelle la même logique de validation que `InscriptionVendeur.validerCode`).

### 3. Ajouter un vrai bouton fonctionnel "Vérifier mon email" — `src/pages/ProfilVendeur.jsx`
Dans la carte profil, si `email_verified === false` afficher une bannière jaune avec :
- Un badge "Email non vérifié"
- Bouton **"Vérifier maintenant"** qui ouvre un `Dialog` avec :
  - Bouton "Envoyer un code" (génère code, met à jour `sellers.email_verification_code/expires_at`, appelle edge function `send-verification-email`)
  - Champ OTP 6 chiffres + bouton "Valider" → met à jour `email_verified=true`, vide le code, toast succès, recharge.
- Réutiliser la même logique que `InscriptionVendeur` (extraire dans un petit hook partagé `useEmailVerification` dans `src/components/`).

### 4. Adapter l'InscriptionVendeur pour reprendre une vérification existante
À l'arrivée sur `/InscriptionVendeur?verify=1&seller_id=...` (renvoi depuis Connexion) :
- Sauter l'étape 1, charger le `seller`, passer directement à l'étape 2 (saisie du code).

### 5. Nettoyage du compte orphelin existant
Une migration ponctuelle pour le compte `ramzydivane9@gmail.com` :
- Soit le supprimer via l'edge function `delete-seller-complete` s'il n'a aucune donnée valide
- Soit le ramener à `seller_status='pending_verification'` pour qu'il soit forcé de vérifier au prochain login.

Choix recommandé : remettre `seller_status='pending_verification'` (garde les données KYC déjà soumises). Le nouveau garde du point 1 le forcera à vérifier.

## Détails techniques

- **Hook partagé** `src/components/useEmailVerification.jsx` : expose `{ sendCode(sellerId, email, nom), verifyCode(sellerId, code) }` — utilisé par `InscriptionVendeur`, `ProfilVendeur` et l'écran de blocage `EspaceVendeur`.
- **RLS** : les UPDATE sur `sellers.email_verification_code` sont déjà autorisés par la policy `Users update own seller (auth.uid() = user_id)` — OK.
- **Edge function** `send-verification-email` existe déjà — aucun changement requis.
- **Migration SQL** unique pour réparer les comptes orphelins existants :
  ```sql
  UPDATE sellers
     SET seller_status = 'pending_verification'
   WHERE email_verified = false
     AND seller_status <> 'pending_verification';
  ```

## Résultat attendu

- Impossible de se connecter, d'atteindre le dashboard vendeur ou d'utiliser l'app sans `email_verified=true`.
- Le bouton "Vérifier mon email" du profil ouvre un vrai dialog qui envoie un code et valide.
- Les comptes existants non vérifiés sont remis dans le flux de vérification au prochain login.
