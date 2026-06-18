## Problème

Lors de l'inscription, certains vendeurs reçoivent le message brut de Supabase :
> *"For security purposes, you can only request this after 43 seconds."*

C'est le throttle anti-abus de GoTrue (Supabase Auth) appliqué par email/IP sur la création de compte. Il se déclenche lorsque :
- le même email vient d'être créé puis supprimé (rollback d'un essai précédent qui a échoué côté `sellers` ou `send-verification-email`),
- ou plusieurs inscriptions partent de la même IP en moins d'une minute.

Aujourd'hui, l'edge function `register-seller` renvoie ce message brut en anglais, et `InscriptionVendeur.jsx` l'affiche tel quel — sans cooldown visuel ni traduction.

## Correctif (UI + messages uniquement, aucun changement de schéma)

### 1. `supabase/functions/register-seller/index.ts`
Après l'appel `admin.auth.admin.createUser(...)`, intercepter spécifiquement l'erreur de throttle :

- Détection : `authErr.status === 429` **ou** `authErr.message` contient `for security purposes` / `only request this after` / `over_email_send_rate`.
- Extraire le nombre de secondes avec `/(\d+)\s*second/i`.
- Renvoyer :
  ```json
  {
    "error": "Trop de tentatives. Pour des raisons de sécurité, patientez {N}s avant de réessayer.",
    "retry_after": N,
    "throttled": true
  }
  ```
  avec status `429`.

Aucune autre branche du flux n'est modifiée (resume, rollback, validations restent identiques).

### 2. `src/pages/InscriptionVendeur.jsx`
Dans `handleRegister` :

- Si la réponse contient `payload.throttled` ou `payload.retry_after > 0` :
  - alimenter `cooldownLeft` (l'état existant déjà utilisé par `renvoyerCode`) avec `retry_after`,
  - afficher le message français via `toast({ title: "⏳ Patientez", description: ..., variant: "destructive" })`,
  - désactiver le bouton "Créer mon compte" tant que `cooldownLeft > 0` et y afficher `Réessayer dans {cooldownLeft}s`.
- Garder la gestion actuelle pour les autres erreurs.

### 3. Aucune modification
- `resend-verification-code` gère déjà son propre cooldown 60s — pas touché.
- Pas de migration SQL, pas de nouveau secret, pas de changement d'auth config.
- Les autres pages, tests audit-01..24 et e2e `suppression-compte-vendeur.spec.ts` ne sont pas impactés.

## Vérification

- Build + `bun run test` (les 169 tests doivent rester verts — aucun ne dépend du message d'erreur).
- Sanity check manuel : déclencher 2 inscriptions rapprochées avec le même email → la 2ᵉ doit afficher *"Trop de tentatives. Pour des raisons de sécurité, patientez Xs avant de réessayer."* et un compteur sur le bouton.
