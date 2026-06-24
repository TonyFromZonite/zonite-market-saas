# Audit du vendeur [fotsingsadeu@gmail.com](mailto:fotsingsadeu@gmail.com) (Owen Fotsing)

## Données réelles en base

**Compte vendeur** (id `fa6deb03…11872`) :

- `solde_commission` affiché : **31 000 FCFA**
- `solde_en_attente` : 0
- `total_commissions_gagnees` : 33 000
- `total_commissions_payees` : 15 000

**Chiffre d'affaires (table `ventes`, = commandes livrées)** :


| Jour      | Cmds   | CA          | Commission |
| --------- | ------ | ----------- | ---------- |
| 11/06     | 1      | 10 000      | 2 000      |
| 13/06     | 1      | 10 000      | 2 000      |
| 14/06     | 1      | 12 000      | 5 500      |
| 15/06     | 1      | 10 000      | 4 000      |
| 17/06     | 4      | 44 000      | 14 000     |
| 18/06     | 1      | 11 000      | 3 000      |
| 20/06     | 1      | 12 000      | 3 500      |
| **Total** | **10** | **109 000** | **34 000** |


Cohérent côté admin : `commandes_vendeur` statut `livree` → 10 cmds / 109 000 FCFA. CA OK ✅

**Ajustement admin** : −1 000 FCFA le 18/06 (frais livraison échouée hôtel Faya).
→ `total_commissions_gagnees` net attendu = 34 000 − 1 000 = **33 000** ✅

**Demandes de paiement** :

- Payées : 5 000 (15/06) + 10 000 (18/06) = **15 000** ✅
- Rejetées : 13 000 + 13 000 (24/06, motif « Solde insuffisant »)

## Incohérence détectée ⚠️

Solde théorique = gagnées − payées − en_attente = 33 000 − 15 000 − 0 = **18 000 FCFA**
Solde affiché = **31 000 FCFA**
**Écart = +13 000 FCFA en faveur du vendeur**

**Cause** : une des deux demandes rejetées du 24/06 a déclenché `restore_seller_balance(+13 000)` alors qu'aucune réservation préalable n'avait été faite (solde_en_attente était déjà à 0). La fonction `restore_seller_balance` crédite `solde_commission` sans vérifier qu'une réservation existe → crédit fantôme.

## Plan de correction

### 1. Correction immédiate du solde (donnée)

Ajustement admin de **−13 000 FCFA** via `admin_adjust_seller_commission` :

- Motif : « Régularisation : restauration en double suite à demande paiement rejetée du 24/06 »
- Résultat : solde 31 000 → 18 000 (cohérent avec gagnées 33 000 − payées 15 000)
- Crée automatiquement l'entrée audit + notification vendeur

### 2. Correctif logique (à valider séparément, hors scope strict de cette demande)

La RPC `restore_seller_balance` peut produire des crédits fantômes si appelée sans réservation préalable. Deux pistes :

- Soit garantir que `reserve_seller_balance` est appelé à la création de chaque demande de paiement (ce qui semble être l'intention initiale du flow `solde_en_attente`).
- Soit borner `restore` au minimum entre `_amount` et `solde_en_attente` actuel.

Cette partie reste **en attente de ton accord** car elle touche la logique métier de paiements ; je propose de la traiter dans une itération dédiée après validation.

### 3. Vérification post-correction

Re-lecture des 4 compteurs du vendeur et confirmation : `solde_commission = 33 000 − 15 000 = 18 000`, `solde_en_attente = 0`.

## Récap périodes (à communiquer au vendeur si besoin)

- CA total réalisé : **109 000 FCFA** sur 10 commandes livrées (11/06 → 20/06)
- Commissions brutes : 34 000 — ajustement −1 000 = **33 000**
- Déjà retiré : **15 000** (2 paiements OK)
- **Solde réel disponible : 18 000 FCFA** (et non 31 000)

Approuve ce plan pour que j'applique l'ajustement de −13 000 FCFA (étape 1). L'étape 2 sera proposée séparément.

faites aussi de meme pour tout les vendeur afin d'afficher les CA exacte en frontend cote admin et vendeur