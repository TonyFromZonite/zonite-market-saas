## Problème

La vendeuse a vu son solde inchangé après ton approbation du retrait. En base, on retrouve le même symptôme chez plusieurs vendeurs : leur `solde_commission` n'a pas été décrémenté malgré une demande passée à `payee`.

Exemples actuels :
- Stéphane Obama : 5 000 FCFA payés, solde encore à 5 000.
- Joel Balla : 5 200 payés, solde encore à 5 700 (devrait être 500).
- Marie Amougou, Joseph Podka, Owen Fotsing : mêmes incohérences.

## Cause racine

Le trigger de sécurité `prevent_seller_privileged_updates` (ajouté récemment pour protéger les colonnes sensibles) bloque toute modification de `solde_commission` / `solde_en_attente` lorsque l'appelant n'est pas admin — **même quand la modification passe par les RPC légitimes** (`reserve_seller_balance`, `approve_seller_payment`, `restore_seller_balance`, `credit_seller_commission`, `debit_seller_commission`, `adjust_seller_commission`). Ces fonctions sont `SECURITY DEFINER`, mais `auth.uid()` reste celui du vendeur, donc le trigger lève "Modification non autorisée".

Conséquences observées :
- Côté vendeur, dans `/DemandePaiement.jsx` : la ligne `demandes_paiement_vendeur` est insérée AVANT l'appel `reserve_seller_balance`. Quand la RPC échoue silencieusement, la demande reste en base mais le solde n'est pas réservé.
- Côté admin, `approve_seller_payment` réussit (admin a les droits) mais ne décrémente que `solde_en_attente` (déjà à 0). Le `solde_commission` initial n'a jamais bougé → le vendeur voit toujours son ancien solde.

## Plan de correction

### 1) Trigger : autoriser les RPC internes
Ajouter un drapeau de session (`app.bypass_seller_balance_guard`) que chaque RPC de mouvement de solde active via `set_config(..., true)` (scope transaction). Le trigger vérifie ce drapeau et n'examine alors **que** les champs financiers (`solde_commission`, `solde_en_attente`, `total_commissions_gagnees`, `total_commissions_payees`) — les autres champs sensibles (role, statut_kyc, email, user_id, etc.) restent verrouillés.

RPC à modifier (toutes existantes) :
`reserve_seller_balance`, `approve_seller_payment`, `restore_seller_balance`, `credit_seller_commission`, `debit_seller_commission`, `adjust_seller_commission`.

### 2) Réconciliation des soldes incohérents
Migration ponctuelle qui, pour chaque vendeur ayant des demandes `payee`, recalcule :
```
solde_commission = max(0, total_commissions_gagnees − total_commissions_payees − solde_en_attente)
```
en se basant sur `total_commissions_gagnees` reconstruit depuis `ventes.commission_vendeur` quand il diverge (cas Landry, Mba, Zeinang où `total_commissions_gagnees = 0` alors qu'il y a des ventes).

Avant exécution, un `SELECT` d'aperçu te listera les nouveaux soldes proposés pour validation visuelle.

### 3) Robustesse côté `/DemandePaiement.jsx`
Inverser l'ordre : appeler `reserve_seller_balance` d'abord, puis `INSERT` la demande seulement si la réservation a réussi. Si l'insert échoue ensuite, appeler `restore_seller_balance` en compensation. Cela évite toute future demande "orpheline".

### 4) Vérification post-déploiement
- Test côté vendeur : depuis un compte test, faire une demande de retrait et confirmer que le solde passe immédiatement en "en attente".
- Test côté admin : approuver, confirmer que `solde_commission` et `solde_en_attente` sont à jour, et que le vendeur voit 0.
- Audit SQL final : la requête de la section 2 ne doit plus retourner de divergence.

## Détails techniques

- Migration `supabase/migrations/<timestamp>_fix_seller_balance_guard.sql` : 
  - `CREATE OR REPLACE` du trigger `prevent_seller_privileged_updates` avec lecture de `current_setting('app.bypass_seller_balance_guard', true)`.
  - `CREATE OR REPLACE` des 6 RPC ci-dessus avec `PERFORM set_config('app.bypass_seller_balance_guard','on',true);` en première ligne.
  - Bloc `UPDATE sellers SET solde_commission = ...` de réconciliation.
- Edit `src/pages/DemandePaiement.jsx` : réorganisation du flux `try/catch` (réserve → insert → compensation si insert KO).
- Aucun changement UI.