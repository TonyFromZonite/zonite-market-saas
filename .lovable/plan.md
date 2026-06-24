# Plan — QA complète avant publication

Objectif : vérifier que les modifications récentes (retraits, polling solde, cleanup realtime, durcissement sécurité OTP/email, blocklist domaines) n'ont rien cassé, et que la logique métier reste cohérente.

## 1. Vérifications automatiques (sans clic)

- **Tests Vitest** : exécuter la suite complète (`audit-01` à `audit-24` + tests dédiés) et corriger uniquement les régressions liées à nos modifs.
- **Scan sécurité** : `security--run_security_scan` puis lecture des résultats. Critique = bloquant pour la publication.
- **Lint DB** : revue rapide des warnings du linter Supabase (seulement ceux introduits par nos migrations récentes).

## 2. Vérifications base de données (lectures uniquement, via psql)

- Aucun `solde_commission < 0` ni `solde_en_attente < 0`.
- Cohérence retraits : pour chaque vendeur ayant des `demandes_paiement_vendeur` en `approuvee`, vérifier que `total_commissions_payees ≥ SUM(montant approuvé)`.
- Cohérence ajustements : `ajustements_commission` reflète bien des entrées (10 lignes connues).
- Policies RLS critiques toujours présentes sur `produits`, `ventes`, `commandes_vendeur`, `sellers`, `demandes_paiement_vendeur`.
- Colonnes OTP : `email_verification_code` non lisible par `authenticated` (vérification via `information_schema.column_privileges`).

## 3. Tests E2E via Playwright (sandbox, headless)

Tous les flux ci-dessous tournent sur `localhost:8080` avec session vendeur injectée. Capture d'écran à chaque étape clé.

### Flux vendeur
1. **Connexion** → `/EspaceVendeur` charge sans erreur console, solde affiché.
2. **Polling solde** : simuler un UPDATE direct du solde côté admin, vérifier que `/EspaceVendeur` rafraîchit dans les 5 s (fallback polling).
3. **Demande de retrait** : créer une demande, vérifier `solde_commission` ↓ et `solde_en_attente` ↑.
4. **Approbation admin** : se reconnecter en admin, valider la demande, vérifier solde vendeur mis à jour côté UI (temps réel + polling).
5. **Rejet admin** : créer une 2e demande, rejeter, vérifier restauration du solde.
6. **Catalogue** : vendeur actif voit les produits actifs (RLS).
7. **Ventes** : vendeur voit uniquement ses propres `ventes` et `commandes_vendeur`.

### Flux email/OTP
8. **OTP resend anonyme** : appel sans JWT → 401.
9. **OTP resend pour un autre vendeur** : 403.
10. **OTP resend domaine bloqué** (`@mailinator.com`) : 400 « Domaine non autorisé ».
11. **send-verification-email anonyme** : 401.

### Flux admin
12. **Liste demandes paiement** : affichage cohérent.
13. **Suppression vendeur** : non testée (destructive) — vérification visuelle uniquement.

## 4. Vérifications manuelles côté UI (preview)

- Aucune erreur dans la console à l'ouverture de `/EspaceVendeur`, `/TableauDeBord`, `/PaiementsVendeurs`, `/CatalogueVendeur`.
- Memory leaks : navigation rapide entre pages 10× → pas de warnings React `unmounted component`.
- Mobile viewport (375×812) : bottom-nav, pull-to-refresh OK sur `/EspaceVendeur`.

## 5. Critères de publication (GO/NO-GO)

| Critère | Bloquant ? |
|---|---|
| Tous les tests Vitest passent | Oui |
| Scan sécurité : 0 critique non résolu | Oui |
| 0 solde négatif, RLS en place | Oui |
| Flux retrait (demande/approuve/rejette) cohérent côté UI | Oui |
| OTP : 4 cas anti-abus retournent les bons codes | Oui |
| Memory leak realtime non observé | Non (warning) |
| Lint DB warnings préexistants | Non |

## 6. Si tout vert → publication

- Pré-flight metadata : vérifier `index.html` (title, meta description, OG, favicon) — déjà standardisé selon la mémoire projet.
- `preview_ui--publish` avec `website_info_status: already_relevant`.

## Hors scope (zero-regression policy)

- Pas de refacto, pas de changement UI, pas de nouveaux features.
- Pas de migration corrective non demandée (sauf si un test révèle une régression directement causée par les modifs récentes).
- Pas de fix des 46 warnings linter préexistants.

## Validation attendue de ta part

Réponds simplement :
- **OK** → je passe en build et j'exécute le plan section par section, en t'envoyant les résultats avant publication.
- Ou liste les sections à retirer/ajouter.
