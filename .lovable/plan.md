## Bug identifié

Dans `src/pages/ResoumissionKYC.jsx`, la fonction `soumettre()` (ligne 113) utilise la variable `isResubmission` aux lignes 136-137 (dans le `notifications_admin.insert(...)`) **avant** qu'elle ne soit déclarée à la ligne 168.

```js
// Ligne 136 — utilisation
titre: isResubmission ? '🪪 KYC Resoumis' : '🪪 Nouveau KYC',
// ...
// Ligne 168 — déclaration (trop tard)
const isResubmission = vendeur.statut_kyc === 'rejete';
```

En JavaScript, accéder à un `const` avant sa déclaration déclenche une **ReferenceError (Temporal Dead Zone)**. Conséquence du flux actuel :

1. ✅ `UPDATE sellers ... statut_kyc='en_attente'` réussit
2. ❌ La construction du payload `notifications_admin.insert(...)` jette l'erreur TDZ
3. ❌ **Aucune notification n'est créée pour l'admin**
4. Le vendeur voit un toast d'erreur, mais comme son `statut_kyc` est passé à `en_attente`, la bannière "KYC en attente" s'affiche et il croit que c'est envoyé
5. L'admin ne reçoit jamais rien → ne voit la demande que s'il ouvre manuellement la page `GestionKYC`

Vérifications faites :
- RLS sur `notifications_admin` : OK, `authenticated` peut insérer.
- Aucun autre chemin de soumission KYC dans l'app (seule `ResoumissionKYC.jsx` gère soumission initiale + resoumission).
- 56 notifications KYC historiques en base → le système fonctionnait avant, c'est bien une régression introduite par la déclaration tardive de `isResubmission`.

## Correctif (1 seul fichier, 2 lignes)

**`src/pages/ResoumissionKYC.jsx`** — déplacer le calcul de `isResubmission` à l'intérieur de `soumettre()`, juste après le chargement de `vendeur` :

```js
const soumettre = async () => {
  if (!allDocsUploaded()) { ... }
  setEnCours(true);
  setErreur("");
  const isResubmission = vendeur.statut_kyc === 'rejete';  // ← AJOUT ICI
  try {
    ...
```

Et **renommer** la constante à la ligne 168 pour éviter le shadowing accidentel (ou la laisser, elle est dans un scope différent — le composant — et reste utilisable pour le rendu JSX). En pratique, il suffit de déclarer la constante locale dans `soumettre()` avant le `try`. La constante de niveau composant à la ligne 168 reste inchangée et continue d'alimenter l'affichage conditionnel ("Dossier KYC Validé", etc.).

## Aucune modification

- Pas de changement de schéma, RLS, edge function, ou logique métier.
- Pas de modification de l'UI ou des autres fichiers KYC (`GestionKYC.jsx`, `EspaceVendeur.jsx`, etc.).
- Pas d'impact sur les 56 notifications KYC existantes.

## Validation après correctif

1. Un vendeur soumet son KYC → toast de succès, pas d'erreur.
2. Vérifier en DB : `SELECT * FROM notifications_admin WHERE type='kyc' ORDER BY created_at DESC LIMIT 1` doit montrer la nouvelle entrée.
3. L'admin reçoit la notification temps réel via le canal `notifs_admin_rt`.
