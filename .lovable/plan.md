## Diagnostic

Les "erreurs critiques" `[ALERT] login_failed` reçues dans le Journal d'Audit ne sont **pas de vraies erreurs système** — ce sont simplement des utilisateurs qui ont tapé un mauvais mot de passe.

Exemples des 24 dernières heures (table `journal_audit`) :

| Heure | Identifiant | Code erreur Supabase |
|---|---|---|
| 13/06 08:38 | mcarinenanette@gmail.com | `invalid_credentials` |
| 13/06 05:57 | @tony91 | `invalid_credentials` |
| 13/06 03:08 | habibkamagate5@gmail.com (×3) | `invalid_credentials` |

**Cause** — `src/pages/Connexion.jsx` (lignes 78-88) appelle `logCritical({ category: "auth", action: "login_failed" })` dès que `signInWithPassword` retourne une erreur, **quel que soit le code**. `logCritical` préfixe alors la ligne par `[ALERT]`, ce qui :
1. l'affiche dans la bannière rouge `AlertesCritiquesAdmin` du Tableau de Bord,
2. la fait apparaître comme "erreur critique d'authentification" alors qu'il s'agit juste d'un mot de passe erroné côté utilisateur.

Aucun vrai dysfonctionnement n'est en cours : le système de connexion fonctionne (les logs Supabase Auth montrent des logins réussis normalement, ex. Joseph Podka à 09:41, l'admin à 09:44).

## Correctif proposé

Distinguer **erreur système** vs **mauvais identifiant utilisateur** dans `Connexion.jsx` :

- Si `authError.code === "invalid_credentials"` (ou message équivalent) → **ne plus appeler `logCritical`**. Écrire à la place une entrée simple dans `journal_audit` avec `module = "auth"`, `action = "login_failed"` (sans le préfixe `[ALERT]`). Cela conserve la traçabilité (utile pour détecter du brute-force) sans déclencher la bannière rouge admin.
- Garder `logCritical` uniquement pour les **vraies pannes auth** : erreur réseau, `AuthRetryableFetchError`, 500, code inattendu, RPC `resolve_username_to_email` qui échoue à cause d'un problème serveur, etc.

Optionnel (à confirmer) : ajouter un compteur simple côté `AlertesCritiquesAdmin` ou un filtre pour ignorer aussi tout résiduel `action = "[ALERT] login_failed"` avec `error.code = invalid_credentials` si on en croise encore dans les 24h d'historique.

## Fichiers modifiés

- `src/pages/Connexion.jsx` — branche conditionnelle sur `authError.code` avant `logCritical`, insertion légère dans `journal_audit` pour les mauvais mots de passe.

## Hors scope

- Aucune modification de la logique d'authentification, des rôles, du flux KYC, du catalogue, ou des autres composants.
- Pas de purge automatique des anciennes alertes — l'admin peut simplement cliquer sur la croix de la bannière, et elles disparaîtront naturellement après 24h (filtre de `AlertesCritiquesAdmin`).
