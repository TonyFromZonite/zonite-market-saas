# Plan — Faire taire définitivement les 7 alertes sécurité récurrentes

## Pourquoi elles reviennent à chaque scan

Le scanner ne mémorise pas les findings tant qu'on ne les marque pas explicitement. Or **les 7 alertes affichées actuellement disent toutes elles-mêmes « No issue » / « fail-closed » / « No security finding »** dans leur description. Ce sont des faux positifs ou des comportements intentionnels.

Tant qu'on ne les **ignore** pas formellement via `manage_security_finding` ET qu'on ne met pas à jour `@security-memory` pour guider les futurs scans, elles réapparaîtront à chaque scan.

## Analyse des 7 findings (tous level `warn`)

| # | internal_id | Verdict |
|---|---|---|
| 1 | `coursiers_no_seller_read` | Faux positif — scanner reconnaît lui-même « No issue ». Coursiers réservés à l'admin = logique métier voulue. |
| 2 | `faq_items_authenticated_only` | Non-sécurité (UX). FAQ restreinte aux vendeurs connectés = volontaire (la FAQ contient des règles internes vendeurs). |
| 3 | `journal_audit_realtime_all_authenticated` | Faux positif — RLS SELECT admin-only filtre déjà les events Realtime. |
| 4 | `livraisons_public_read` | Faux positif — fail-closed (aucune policy SELECT publique). |
| 5 | `commandes_vendeur_realtime_client_pii` | Mitigation déjà en place (column allowlist Realtime exclut PII client). À documenter. |
| 6 | `sellers_realtime_broadcast_pii` | Comportement attendu — RLS filtre par owner ; les admins reçoivent tout, c'est voulu. |
| 7 | `candidatures_vendeur_anon_insert` | Faux positif — fail-closed (RLS sans policy INSERT anon). |

## Actions

### 1. Marquer les 7 findings comme `ignore` (avec explication)
Appel unique batch à `security--manage_security_finding` avec les 7 `internal_id` et le raisonnement métier pour chacun.

### 2. Mettre à jour `@security-memory`
Ajouter une section « Accepted/intentional patterns » qui couvre :
- Tables admin-only (`coursiers`, `livraisons`, `journal_audit`, `candidatures_vendeur`) — fail-closed sans policy publique, c'est voulu.
- FAQ restreinte aux vendeurs authentifiés — UX, pas sécurité.
- Realtime sur `commandes_vendeur` : column allowlist exclut `client_nom`, `client_telephone`, `client_adresse`, `client_ville`, `client_quartier`.
- Realtime sur `sellers` : RLS par owner ; admins reçoivent tout par design.

Objectif : guider les scans futurs pour qu'ils ne re-soulèvent pas ces patterns intentionnels.

### 3. Pas de changement de code / migration
Aucune policy à modifier, aucune migration. Tout est déjà correctement configuré ; le seul problème est documentaire/scanner.

## Hors scope
- Les 51 findings DB du scanner Supabase (`SECURITY DEFINER` views/functions) — déjà discutés, intentionnels (architecture RLS auth), zero-regression policy.
- FIX éventuel pour rendre la FAQ publique (`anon` SELECT) : c'est un choix produit, pas un fix sécurité — à demander séparément si tu veux ça.

## Validation
Réponds **OK** et je passe en build pour appliquer les 2 actions (1 appel `manage_security_finding` + 1 appel `update_memory`).
