## Diagnostic

Les **6 alertes** affichées dans la bannière sont des **résidus / faux positifs**, pas de vraies erreurs système :

| # | Heure (UTC) | Action | Cause réelle |
|---|---|---|---|
| 1 | 11:43 | `[ALERT] unhandled_rejection` | `NotAllowedError` — l'utilisateur a refusé une permission navigateur (notification / biométrie). Pas un bug. |
| 2 | 08:38 | `[ALERT] login_failed` | `invalid_credentials` — mauvais mot de passe utilisateur. Écrite **avant** le correctif d'hier. |
| 3 | 05:57 | `[ALERT] login_failed` | idem (`@tony91`) |
| 4-6 | 03:08 (×3) | `[ALERT] login_failed` | idem (`habibkamagate5@gmail.com`, 3 essais successifs) |

Le correctif de `Connexion.jsx` fonctionne bien (aucune nouvelle entrée `[ALERT] login_failed` depuis le déploiement). Les 5 lignes auth sont juste **antérieures** au correctif et resteront visibles pendant la fenêtre de 24h. La 6ème (`NotAllowedError`) provient de `criticalLogger.installGlobalCriticalHandlers` qui capture toute promesse rejetée, y compris les permissions refusées qui ne sont pas des erreurs.

## Correctif proposé

**1. `src/lib/criticalLogger.js` — filtrer `NotAllowedError`** dans le gestionnaire global `unhandledrejection` (au même titre que `AbortError` et `ResizeObserver` déjà filtrés). Une permission refusée par l'utilisateur n'est pas une erreur critique.

**2. `src/components/admin/AlertesCritiquesAdmin.jsx` — ignorer les faux positifs résiduels** au chargement et en realtime :
- ligne dont `details.error.code === "invalid_credentials"` → ne pas afficher
- ligne dont `details.error.name === "NotAllowedError"` → ne pas afficher

Cela fera disparaître **immédiatement** les 6 alertes actuelles de la bannière sans toucher au journal d'audit (la traçabilité reste pour consultation manuelle).

## Hors scope

- Pas de purge SQL du `journal_audit` : on garde l'historique.
- Pas de modification de la logique d'authentification ni des autres flux.
- Pas de changement du `JournalAudit.jsx` : le filtre `?alert=...` continue de fonctionner pour les vraies alertes.

## Fichiers modifiés

- `src/lib/criticalLogger.js` — ajout de `NotAllowedError` dans la regex de filtrage des rejets non gérés.
- `src/components/admin/AlertesCritiquesAdmin.jsx` — filtre côté affichage pour ignorer `invalid_credentials` et `NotAllowedError`.
