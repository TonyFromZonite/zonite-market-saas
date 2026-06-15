
# Analyse des 12 alertes critiques (24h)

J'ai inspecté la table `journal_audit`. Les 12 alertes ne révèlent **aucun bug applicatif réel** — ce sont toutes des situations connues qu'il faut soit gérer proprement, soit exclure du flux d'alertes critiques.

## Répartition

| Catégorie | Nb | Cause réelle |
|---|---|---|
| Système — `Failed to fetch dynamically imported module` (InscriptionVendeur, EspaceVendeur) | 2 | Chunks JS périmés après un déploiement. L'utilisateur a un onglet ouvert avec un ancien `index.html` qui pointe vers des hashes Vite qui n'existent plus. |
| Système — `insertBefore` / `removeChild` `NotFoundError` dans `react-core` | 4 | Extensions navigateur (Google Translate, Grammarly…) qui modifient le DOM et cassent la réconciliation React. Bruit connu, hors de notre contrôle. |
| KYC — `kyc_upload_failed` / `StorageUnknownError` / `Failed to fetch` | 5 | Vendeur `djimitryazafack@gmail.com` : panne réseau pendant l'upload. Pas un bug serveur, pas un bucket cassé — l'utilisateur a relancé jusqu'à réussir. |
| Auth — `login_failed` / `email_not_confirmed` | 1 | État utilisateur légitime, déjà géré par l'UI. Ne devrait jamais déclencher d'alerte critique. |

## Objectif

Garder le canal "Alertes critiques" pertinent : ne plus polluer le dashboard admin avec des faux positifs, et améliorer l'expérience utilisateur sur les deux vrais inconforts (chunks périmés + upload KYC en réseau instable).

## Changements proposés

### 1. `src/lib/criticalLogger.js` — élargir la liste des faux positifs ignorés

Dans `installGlobalCriticalHandlers` (handlers `unhandledrejection` et `error`), étendre le regex de filtrage pour inclure :
- `Failed to fetch dynamically imported module` → traité séparément (cf. point 2)
- `Failed to execute 'insertBefore' on 'Node'`
- `Failed to execute 'removeChild' on 'Node'`
- `The node (to be removed|before which the new node) is (not a child|is not a child) of this node`
- `Loading chunk \d+ failed`

Dans `logCritical`, si `action === "login_failed"` et `error.code === "email_not_confirmed"` ou `invalid_credentials`, basculer en `alert: false` (logué silencieusement, pas d'insert `[ALERT]`).

### 2. `src/main.jsx` — auto-rechargement sur chunk périmé

Ajouter un handler dédié qui, lorsqu'une erreur "Failed to fetch dynamically imported module" survient :
1. Vérifie un flag `sessionStorage.getItem("zonite:chunk-reloaded")` pour éviter une boucle.
2. Pose le flag et appelle `window.location.reload()` (le nouvel `index.html` chargera les bons hashes).
3. Au prochain chargement réussi, le flag est effacé.

Ces erreurs ne sont alors plus loguées comme critiques (filtrées au point 1).

### 3. `src/pages/ResoumissionKYC.jsx` (et tout autre appelant de l'upload KYC)

Avant d'appeler `logCritical({ category: "kyc", action: "kyc_upload_failed", … })`, classifier l'erreur :
- Si `navigator.onLine === false` **ou** `error.message` matche `/Failed to fetch|NetworkError|TypeError: Load failed/i` → afficher un toast "Connexion instable, réessayez" et **ne pas** logger comme `[ALERT]`. Logger en console + `journal_audit` sans préfixe `[ALERT]` (module `kyc`, action `kyc_upload_network`).
- Sinon (erreur 4xx/5xx, bucket inexistant, RLS) → conserver `logCritical` actuel.

### 4. `src/components/admin/AlertesCritiquesAdmin.jsx` — élargir `isFalsePositive`

Ajouter des cas en plus de ceux existants (`invalid_credentials`, `NotAllowedError`) :
- `err.code === "email_not_confirmed"`
- `/Failed to execute '(insertBefore|removeChild)' on 'Node'/i.test(err.message)`
- `/Failed to fetch dynamically imported module/i.test(err.message)`

Filet de sécurité côté affichage pour les alertes déjà persistées avant ce correctif.

## Détails techniques

- Aucun changement de schéma DB, aucune migration, aucune Edge Function modifiée.
- Aucun impact sur les tests existants (les 24 suites d'audit + 169 tests E2E). Un test léger pourrait être ajouté à `criticalLogger` pour vérifier que `email_not_confirmed` ne déclenche pas l'événement DOM, mais ce n'est pas indispensable.
- La bannière `AlertesCritiquesAdmin` se vide automatiquement après 24h (filtre `since`), donc les 12 alertes actuelles disparaîtront naturellement. Optionnellement : un bouton "Marquer comme lu" qui pose `dismissed` dans `localStorage` pour ne pas réapparaître au refresh — à décider.

## Hors scope (à confirmer)

- Purger les 12 entrées `[ALERT]` existantes de `journal_audit` ? (préserve l'historique d'audit, je recommande de ne pas purger.)
- Investiguer le vendeur `djimitryazafack@gmail.com` : voulez-vous qu'on lui envoie un email proactif via la file `process-email-queue` pour vérifier que son KYC a bien abouti ?
