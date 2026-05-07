## Objectif

Permettre à l'admin d'augmenter ou diminuer le solde commission d'un vendeur depuis la page **Commissions**, en saisissant obligatoirement un motif. Le vendeur reçoit une notification consultable expliquant l'ajustement.

## Changements base de données

**Nouvelle table `ajustements_commission`** (historique complet) :
- `vendeur_id` (uuid, ref sellers)
- `montant` (numeric, positif = crédit, négatif = débit)
- `motif` (text, obligatoire)
- `solde_avant`, `solde_apres` (numeric)
- `effectue_par` (text, email admin)
- `created_at`

RLS :
- Admins : ALL via `has_role(auth.uid(), 'admin')`
- Vendeurs : SELECT sur leurs propres ajustements via `vendeur_id = get_seller_id_for_user(auth.uid())`

**Nouvelle fonction RPC `admin_adjust_seller_commission(_seller_id, _delta, _motif, _admin_email)`** (`SECURITY DEFINER`) :
- Vérifie via `has_role` que l'appelant est admin (sinon `RAISE EXCEPTION`)
- Récupère solde actuel, applique le delta avec `GREATEST(0, ...)` pour éviter solde négatif
- Met aussi à jour `total_commissions_gagnees` (en cohérence avec les RPC existants `credit_seller_commission` / `debit_seller_commission`)
- Insère une ligne dans `ajustements_commission`
- Insère une notification dans `notifications_vendeur` avec titre "Ajustement de votre solde" + message contenant montant et motif

## Changements UI

**`src/pages/Commissions.jsx`** :
- Ajouter une colonne "Action" dans le tableau "Soldes des Vendeurs" avec un bouton "Ajuster"
- Nouveau dialog `DialogAjustementCommission` :
  - Type : Crédit (+) / Débit (−) (radio)
  - Montant FCFA (input number, > 0)
  - Motif (textarea, requis, min 5 caractères)
  - Aperçu : solde actuel → solde après
  - Validation Zod côté client
  - Appel `supabase.rpc('admin_adjust_seller_commission', ...)`
  - Toast succès, invalidate queries `vendeurs`
- Nouvelle section "Historique des ajustements" sous l'historique des paiements (date, vendeur, montant ±, motif, par qui)

**`src/pages/EspaceVendeur.jsx`** (côté vendeur) :
- Les ajustements arrivent déjà via `notifications_vendeur` (système existant). Pas de changement requis — la notif s'affichera automatiquement dans le NotificationCenterVendeur avec titre + message + motif.

## Sécurité

- Mutation exclusivement via RPC `SECURITY DEFINER` qui re-vérifie `has_role(auth.uid(), 'admin')` côté serveur — pas de dépendance à `localStorage` admin_session.
- Action enregistrée dans `journal_audit` (module: 'commissions', action: 'ajustement_solde').

## Fichiers modifiés
- Migration SQL (nouvelle table + RPC)
- `src/pages/Commissions.jsx` (colonne action, dialog, historique)
