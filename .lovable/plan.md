## Objectif

Empêcher que les 3 failles qu'on vient de corriger (lecture de `prix_achat` par les vendeurs, lecture des marges sur `ventes`, UPDATE de colonnes privilégiées sur `sellers`) ne réapparaissent — par migration accidentelle, refactor, ou nouvelle policy.

## Principe : 3 couches de garde-fou

1. **Garde-fou DB** (migrations Postgres) — bloque la régression à la racine.
2. **Tests automatisés** (Vitest, suite `audit-29`) — rouge si une régression est introduite.
3. **CI** — la suite est ajoutée au job `soldes-invariants` et bloque les merges.
4. **Security memory** — documente les invariants pour les futurs scans et agents.

## Détails techniques

### 1. Garde-fous DB (nouvelle migration)

**a) Event trigger anti-policy permissive sur colonnes sensibles**
Un event trigger sur `ddl_command_end` qui, à chaque `CREATE POLICY` / `ALTER POLICY` sur `public.produits`, `public.ventes`, `public.sellers`, refuse :
- toute policy `SELECT` ou `ALL` sur `produits` / `ventes` accordée au rôle `authenticated` ou `anon` qui n'est PAS limitée par `is_admin_or_sous_admin(auth.uid())` ou `has_role(auth.uid(),'admin')` — sauf si elle s'appelle exactement `Admins …`.
- toute policy `UPDATE` ou `ALL` sur `sellers` accordée à `authenticated`/`anon` dont le `WITH CHECK` ne mentionne PAS `seller_self_update_only_safe` (sauf policies admin).

Si la condition est violée → `RAISE EXCEPTION` → la migration entière rollback.

**b) Verrou GRANT au niveau colonnes (defense in depth)**
```sql
REVOKE SELECT (prix_achat) ON public.produits FROM anon;
REVOKE SELECT (prix_achat, prix_achat_unitaire, profit_zonite, marge_zonite)
  ON public.ventes FROM anon;
```
(On garde `authenticated` car les admins en ont besoin, mais on coupe `anon`.)

**c) Trigger `prevent_seller_privileged_updates` rendu inopérable à supprimer**
On le marque comme dépendance d'une fonction `__do_not_drop_seller_privilege_guard()` qui `RAISE EXCEPTION` si appelée, et on documente. Si quelqu'un fait `DROP TRIGGER`, il devra aussi casser cette dépendance explicitement.

### 2. Suite de tests `src/test/audit-29-fuites-donnees-sensibles.test.ts`

Tests Vitest qui interrogent directement la base via le client Supabase :

- **T1** : Avec un JWT de vendeur, `from('produits').select('prix_achat').limit(1)` doit retourner `[]` ou `error` (RLS deny). Vérifie aussi `from('produits').select('*')` ne contient pas `prix_achat`.
- **T2** : Avec JWT vendeur, `from('ventes').select('prix_achat, prix_gros, profit_zonite, marge_zonite').limit(1)` doit retourner `[]` ou erreur RLS.
- **T3** : Vue `produits_public` existe et ne contient PAS `prix_achat` (lecture de `information_schema.columns`).
- **T4** : Vue `ventes_vendeur_safe` existe et ne contient AUCUNE de : `prix_achat, prix_achat_unitaire, prix_gros, profit_zonite, marge_zonite`.
- **T5** : Avec JWT vendeur, `update sellers set role='admin' where id=<self>` doit échouer (RLS WITH CHECK).
- **T6** : Idem pour `solde_commission`, `total_commissions_gagnees`, `email_verified`, `catalogue_debloque`, `parraine_par`, `user_id`, `email`.
- **T7** : KYC self-submit légitime (`statut_kyc='en_attente'`) reste autorisé.
- **T8** : Fonction `seller_self_update_only_safe` existe et est `SECURITY DEFINER`.
- **T9** : Scan statique des fichiers `supabase/migrations/*.sql` — refuse toute future migration qui contient `CREATE POLICY ... ON public.produits FOR SELECT` accordée à `authenticated` sans clause `is_admin_or_sous_admin` ou `has_role`. Pareil pour `ventes` et pour `UPDATE` sur `sellers` sans `seller_self_update_only_safe`.
- **T10** : Scan statique du frontend — `rg from\("produits"\)` ne doit pas apparaître dans les pages vendeur listées (`CatalogueVendeur`, `ProduitDetail`, `MesCommandesVendeur`, `EspaceVendeur`, `NouvelleCommandeVendeur`, `ShareProductModal`, `FormulaireVente`). Idem pour `from("ventes")` côté vendeur.

### 3. CI

Ajout de `audit-29-fuites-donnees-sensibles.test.ts` dans le job `soldes-invariants` de `package.json` → bloque les merges si rouge.

### 4. Security memory

Mise à jour pour documenter, à destination des futurs scans et agents :
- Les vendeurs n'accèdent JAMAIS directement à `produits` ou `ventes` — uniquement via les vues `produits_public` et `ventes_vendeur_safe`.
- Les colonnes interdites côté vendeur sont listées explicitement.
- La policy seller `UPDATE` DOIT inclure `seller_self_update_only_safe` dans son `WITH CHECK`.
- Tout futur agent qui propose une policy sans ce verrou doit être rejeté.

## Fichiers touchés

- **Nouveau** : `supabase/migrations/<timestamp>_anti_regression_fuites_donnees.sql`
- **Nouveau** : `src/test/audit-29-fuites-donnees-sensibles.test.ts`
- **Modifié** : `package.json` (ajout du test au job `soldes-invariants`)
- **Modifié** : security memory (via `security--update_memory`)

## Hors-scope

- Pas de changement frontend (les vues sont déjà utilisées partout côté vendeur).
- Pas de rotation des autres findings du scanner (1 error + 2 warnings sont déjà résolus).
