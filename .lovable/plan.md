## Objectif

Retirer la bannière rouge "X erreurs critiques (24h) — KYC · N — Voir le Journal d'Audit" qui apparaît en haut du tableau de bord admin à la connexion.

## Changement

**`src/pages/TableauDeBord.jsx`**
- Supprimer l'import `AlertesCritiquesAdmin` (ligne 30).
- Supprimer le rendu `<AlertesCritiquesAdmin />` (ligne 305).

Le composant `src/components/admin/AlertesCritiquesAdmin.jsx` et le logger `src/lib/criticalLogger.js` sont **conservés** : les erreurs critiques continueront d'être enregistrées dans le journal d'audit et restent consultables via la page `/JournalAudit`. Seul l'affichage de la bannière sur le tableau de bord est masqué.

## Hors scope

- Aucune modification du logger ni du journal d'audit.
- Aucun autre élément du tableau de bord touché.
- Aucun test à modifier (aucun test ne cible cette bannière).
