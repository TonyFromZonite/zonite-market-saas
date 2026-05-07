## Objectif
Ajouter un bouton « Ajuster » sur la page `/Vendeurs` à côté de chaque vendeur afin de créditer/débiter directement la commission sans passer par la page `/Commissions`.

## Approche

1. **Extraire `DialogAjustement`** depuis `src/pages/Commissions.jsx` vers un composant réutilisable `src/components/commissions/DialogAjustementCommission.jsx` (même UI, même RPC `admin_adjust_seller_commission`, même validations).
2. **Mettre à jour `Commissions.jsx`** pour importer ce composant partagé (aucun changement fonctionnel).
3. **Modifier `src/pages/Vendeurs.jsx`** :
   - Importer le dialog partagé et l'icône `Wallet` (ou `Pencil`).
   - Ajouter un état `ajustVendeur`.
   - Ajouter un bouton « Ajuster » dans la colonne actions de chaque ligne vendeur (visible uniquement pour `isAdmin`, pas les sous-admins, conformément aux règles RPC).
   - Brancher le succès pour rafraîchir la liste des vendeurs (invalidation React Query).

## Sécurité
- Le RPC vérifie déjà côté serveur `has_role(auth.uid(), 'admin')` : aucune nouvelle surface d'attaque.
- Bouton masqué pour les sous-admins côté UI pour éviter les erreurs visibles.

## Fichiers touchés
- create `src/components/commissions/DialogAjustementCommission.jsx`
- edit `src/pages/Commissions.jsx` (import du composant extrait)
- edit `src/pages/Vendeurs.jsx` (bouton + dialog)

Aucun changement de logique métier ni de schéma DB.