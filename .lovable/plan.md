# Réactiver la suppression de compte pour les nouveaux vendeurs

## Problème constaté
Dans `src/pages/ProfilVendeur.jsx`, la zone « Suppression définitive du compte » n'est affichée que si `canSelfDeleteAccount(compteVendeur)` renvoie `true`.

Or, dans `src/lib/accountDeletion.js`, cette fonction exige actuellement :
- `seller_status` différent de `pending_verification` (email vérifié) ✅ raisonnable
- `statut_kyc === "valide"` ❌ bloque tous les nouveaux comptes
- email différent de l'admin principal ✅ à conserver

Conséquence : un vendeur fraîchement inscrit (KYC `non_soumis`, `en_attente` ou `rejete`) ne voit plus le bouton et ne peut plus supprimer son compte lui-même.

## Correctif (1 seul fichier modifié)
**`src/lib/accountDeletion.js`** — retirer la contrainte sur `statut_kyc` :
- Supprimer la constante `REQUIRED_KYC_STATUS` (et son export).
- Retirer la ligne `if (seller.statut_kyc !== REQUIRED_KYC_STATUS) return false;` dans `canSelfDeleteAccount`.
- Mettre à jour le commentaire d'en-tête : la suppression reste interdite uniquement pour l'admin principal et tant que l'email n'est pas vérifié (`seller_status === "pending_verification"`).

Aucune autre logique métier, UI ou Edge Function n'est touchée. La protection serveur (Edge Function `delete-seller-complete`) et la protection de l'admin principal restent inchangées.

## Vérification
- Lancer la suite de tests concernée : `audit-24-suppression-compte-vendeur` + `e2e/suppression-compte-vendeur.spec.ts` pour confirmer qu'aucune autre règle ne casse. Ajuster uniquement les assertions liées à `statut_kyc` si elles existaient.
