

## Problème identifié

Lors de l'inscription (`registerVendeur`), le code appelle `supabase.auth.signUp()` qui déclenche **deux emails** :
1. **L'email natif de Supabase Auth** — avec un bouton "Confirmer mon email" (envoyé automatiquement par le système d'authentification)
2. **Votre email personnalisé** via l'edge function `send-verification-email` — avec le code à 6 chiffres

Le problème : l'email Supabase Auth arrive en premier et confond l'utilisateur. Votre frontend attend un code à 6 chiffres, pas un lien de confirmation.

## Solution

**Activer l'auto-confirmation des emails** dans la configuration d'authentification. Cela empêchera Supabase d'envoyer son propre email de confirmation, et seul votre système de code à 6 chiffres sera utilisé.

### Étape unique

Configurer l'authentification pour auto-confirmer les inscriptions email via l'outil `configure_auth`. Cela désactive l'envoi automatique d'email de confirmation par le système d'authentification, laissant votre flux personnalisé (code 6 chiffres via Resend) comme seul mécanisme de vérification.

Aucun changement de code n'est nécessaire — le flux `registerVendeur` dans `base44Client.js` fonctionne déjà correctement : il génère un code, le stocke dans `sellers`, et appelle l'edge function `send-verification-email`.

