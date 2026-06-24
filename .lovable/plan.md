# Plan — Tri des 8 « fixes » demandés

Après lecture du schéma réel et des policies existantes, **la majorité du prompt ne s'applique pas tel quel à ce projet**. Voici le tri honnête, et ce que je propose de faire (ou ne pas faire).

## Audit rapide vs le prompt

| # | Demande | Verdict |
|---|---|---|
| 1 | OTP resend : auth + rate limit | Auth **déjà ajouté** (turn précédent). Rate-limit DB **refusé par la plateforme** (pas de primitive standard). |
| 2 | Email verif : auth + whitelist + audit log | Auth + ownership **déjà ajoutés**. Blocklist domaines + table `email_audit_log` = nouveaux. |
| 3 | `password_reset_codes`, `otp_rate_limits`, `kyc_document_url_raw` | **Tables/colonnes inexistantes** dans ce projet → rien à faire. OTP plaintext déjà révoqué au turn précédent. |
| 4 | Catalogue / categories / variations | Policy `Sellers read active products` **existe déjà**. `variations_produit` **n'existe pas**. |
| 5 | `ventes` / `commandes_vendeur` SELECT pour vendeur | Policies `Sellers read own ventes` + `Sellers view own orders` **existent déjà**. |
| 6 | Recalcul soldes (SUM ventes − retraits approuvés) | **Corrompt les données** : ignore les 10 lignes d'`ajustements_commission` et les 3 bonus de parrainage. Voir options ci-dessous. |
| 7 | Stock `variations_produit` + trigger | Table **inexistante** ; stocks par variation vivent dans `sellers.stocks_par_coursier` (JSONB). Le flux SQL proposé ne peut pas s'exécuter. |
| 8 | Flow retrait | Côté code : déjà géré par RPC `reserve_seller_balance` / `approve_seller_payment` / `restore_seller_balance` (corrigé hier). Côté SQL : les fonctions existent déjà sous d'autres noms. |

État actuel vérifié : **0 vendeur avec solde négatif**, donc rien d'urgent à « nettoyer ».

## Ce que je propose d'exécuter

### A. FIX 2 — durcissement supplémentaire (sûr)
- Ajouter une **blocklist de domaines jetables** (`tempmail`, `guerrillamail`, `mailinator`, `yopmail`, `sharklasers`, `throwaway`) dans `send-verification-email` ET `resend-verification-code`.
- Pas de nouvelle table d'audit : `email_send_log` existe déjà et logge tous les envois.

### B. STEP 1 du précédent message — clamp défensif (sûr, idempotent)
```sql
UPDATE sellers SET solde_commission = 0 WHERE solde_commission < 0;
UPDATE sellers SET solde_en_attente = 0 WHERE solde_en_attente < 0;
```
Actuellement 0 ligne affectée — mais garde-fou utile.

## Ce que je refuse d'exécuter sans confirmation explicite

1. **FIX 6 (recalcul des soldes)** — la formule proposée écrase les 10 ajustements admin et les 3 bonus parrainage. Si tu veux vraiment recalculer, dis-moi laquelle :
   - **a)** `SUM(ventes.commission_vendeur) + SUM(ajustements.montant) + SUM(parrainages.commission_totale) − SUM(retraits approuvés) − solde_en_attente` (formule complète)
   - **b)** Ne rien recalculer (recommandé — aucun solde négatif aujourd'hui)
   - **c)** La formule du prompt tel quel (je préviens : ça va casser des soldes corrects)

2. **FIX 7 (stocks)** — toute la section cible une table inexistante. Si tu veux un audit du JSONB `stocks_par_coursier` à la place, je peux le scripter, mais c'est un autre sujet.

3. **Rate-limiting OTP en DB** — la plateforme Lovable interdit explicitement ce pattern (« no standard rate-limiting primitive »). On a déjà un throttling soft via `email_verification_send_count` + `email_verification_window_start` sur `sellers`.

## Détails techniques

- **Migration unique** pour FIX 2 (blocklist) : édition des 2 edge functions, pas de SQL.
- Pas de modif de policies RLS (déjà correctes pour catalogue, ventes, commandes).
- Pas de modif UI.
- Pas de modif des RPC soldes (déjà en place et auditées hier).

## Ce que j'attends de toi avant build

Réponds simplement :
- **Option 6** : a / b / c ?
- **OK pour appliquer A + B uniquement** (sinon liste ce que tu veux garder).
