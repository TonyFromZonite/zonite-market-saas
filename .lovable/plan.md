## Diagnostic — Lengue Oumar (`lengue86@gmail.com`)

**État actuel du compte**
- `solde_commission` = 0 FCFA
- `solde_en_attente` = 6 000 FCFA (1 demande de paiement de 6 000 F en attente)
- `total_commissions_gagnees` = 6 000 FCFA
- `total_commissions_payees` = 0 FCFA

**Sources de revenus réelles**
| Source | Montant | Détail |
|---|---|---|
| Ventes (table `ventes`) | 6 000 F | 2 ventes, commissions cumulées |
| Parrainage (table `parrainages`) | 1 000 F | Filleul *Bonheur* (`bonheureyenga1@gmail.com`), 2 livraisons × 500 F |
| **Total mérité** | **7 000 F** | |

**Ce qui s'est passé**
La migration d'audit (`Régularisation audit cohérence : écart non justifié par les ventes`) du 24 juin a débité **−1 000 F** via `ajustements_commission` (7 000 → 6 000) en ne regardant que la table `ventes`. Elle a **oublié les commissions de parrainage** (`parrainages.commission_totale`), considérant à tort les 1 000 F comme un "écart non justifié". Le vendeur a donc raison : il manque 1 000 F qui correspondent à sa commission de parrainage légitime.

---

## Plan d'action

### 1. Recrédit du vendeur (migration de correction)

Utiliser `admin_adjust_seller_commission` (ou un `UPDATE` direct via le bypass) pour recréditer **+1 000 FCFA** au solde commission de Lengue Oumar avec :
- **Motif** : `Annulation régularisation erronée : commission de parrainage (filleul Bonheur, 2 livraisons × 500 F) non comptabilisée`
- **Trace** : entrée dans `ajustements_commission` + `journal_audit` + notification au vendeur

Résultat attendu : `solde_commission` = 1 000 F, `solde_en_attente` reste 6 000 F, `total_commissions_gagnees` = 7 000 F.

### 2. Vérification post-correction
- Re-lire la ligne `sellers` pour confirmer les soldes.
- Vérifier qu'aucun autre vendeur ayant des parrainages actifs n'a subi le même débit erroné (scan des `ajustements_commission` du 24 juin avec motif "Régularisation audit cohérence").

### 3. Test de non-régression (`src/test/audit-27-regularisation-inclut-parrainage.test.ts`)

Test Vitest qui :
- Définit la formule canonique du total attendu : `total_commissions_gagnees ≈ Σ ventes.commission_vendeur + Σ parrainages.commission_totale (parrain) − Σ ajustements.montant<0 légitimes`
- Reproduit en JS un cas avec 6 000 F de ventes + 1 000 F de parrainage et vérifie qu'une fonction d'audit `computeExpectedEarnings(seller)` retourne **7 000 F** (pas 6 000 F).
- Cas miroir : un audit qui ignorerait `parrainages` retournerait 6 000 F → le test échoue, prouvant qu'une future "régularisation" sans parrainage est bloquée.
- Vérifie aussi que la migration de correction (fichier SQL du jour) contient le mot-clé `parrainage` dans son motif et un `+1000` pour `e631aae2-26f3-46f0-b9b4-3c3e799067e1`.
- Branché dans le job CI `soldes-invariants` du workflow `.github/workflows/ci.yml` (script `test:soldes-invariants`).

### Détails techniques

- Migration SQL (insert via outil `supabase--insert` car c'est une modification de données, pas de schéma) :
  ```sql
  SELECT admin_adjust_seller_commission(
    'e631aae2-26f3-46f0-b9b4-3c3e799067e1'::uuid,
    1000,
    'Annulation régularisation erronée : commission parrainage (filleul Bonheur, 2 livraisons × 500F) non comptabilisée',
    'system-audit@zonite.org'
  );
  ```
  ⚠️ `admin_adjust_seller_commission` exige `has_role(auth.uid(),'admin')`. Comme la session SQL n'a pas d'`auth.uid()`, on fera plutôt un `UPDATE` direct + `INSERT` dans `ajustements_commission` + `journal_audit` + `notifications_vendeur`, en activant `app.bypass_seller_balance_guard`.
- Mise à jour du script `npm run test:soldes-invariants` pour inclure le nouveau fichier `audit-27`.
