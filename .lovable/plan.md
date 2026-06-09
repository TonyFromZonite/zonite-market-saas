# Problème observé

Certains vendeurs voient parfois "aucun produit" dans le catalogue, puis les produits réapparaissent plus tard. Ce comportement intermittent indique un problème de robustesse de chargement, pas un bug RLS (les politiques et grants sont corrects, la vue `produits_public` est accessible).

# Causes probables identifiées dans `src/pages/CatalogueVendeur.jsx`

1. **N+1 fragile dans `CategoriesGrid`** — la query `categories_with_count` fait `Promise.all` de N HEAD count sur `produits_public`. Si UNE seule requête échoue (timeout, refresh de token Supabase en cours, coupure réseau brève), tout le `Promise.all` rejette → React Query reçoit une erreur → grid vide. Avec `staleTime: 2 min`, l'état vide est mis en cache et l'utilisateur reste bloqué quelques minutes.

2. **Aucune gestion d'erreur visible** — quand la query échoue, on affiche l'état "Catalogue bientôt disponible !" comme s'il n'y avait pas de catégories, ce qui correspond exactement au témoignage des vendeurs.

3. **Requête lancée avant que l'auth soit prête** — `useQuery` part dès le mount, sans attendre `isAuthReady`. Si le token Supabase est en cours de rafraîchissement au moment du mount, certaines requêtes peuvent revenir avec un état dégradé.

4. **`ProduitsParCategorie` filtre `actif=true`** — normal, mais si un admin bascule un produit `actif=false` puis le rebascule, la fenêtre de visibilité est mise en cache 2 min côté vendeur (cohérent avec "ça revient").

5. **Realtime non branché sur produits/categories** — la mémoire mentionne un système Realtime généralisé, mais le catalogue ne s'invalide pas automatiquement quand un produit ou une catégorie change.

# Fix proposé (3 modifications ciblées, frontend uniquement)

## 1. Remplacer le N+1 par une seule requête groupée
Dans `CatalogueVendeur.jsx` → `CategoriesGrid` :
- Récupérer toutes les catégories actives en 1 requête.
- Récupérer en parallèle (1 seule requête) `produits_public` `select id, categorie_id` filtré sur `actif=true`, puis compter en mémoire par `categorie_id`.
- Plus rapide, plus robuste, ne casse plus si un compte unitaire échoue.

## 2. Ajouter une vraie gestion d'erreur + retry
- Distinguer dans la query `isError` vs liste vide réelle.
- Si `isError`, afficher un écran "Problème de connexion — Réessayer" avec bouton qui appelle `refetch()`, au lieu de l'écran "bientôt disponible".
- Passer `retry: 2` avec `retryDelay` exponentiel sur ces queries spécifiques (override du défaut global).
- Réduire `staleTime` à 30 s pour ces queries catalogue afin que les états transitoires se résorbent vite.

## 3. Branchement Realtime léger sur le catalogue
Ajouter un effet qui s'abonne aux changements `produits` et `categories` et appelle `queryClient.invalidateQueries({ queryKey: ["categories_with_count"] })` et `["produits_categorie", …]`. Cela garantit qu'une activation/désactivation côté admin se reflète immédiatement chez le vendeur, sans attendre 2 min ou un pull-to-refresh.

# Hors scope

- Aucun changement RLS, aucun changement de schéma, aucune migration : les politiques et les grants sur `produits_public`, `categories`, `produits` ont été vérifiés et sont corrects.
- Aucun changement de logique métier (filtrage par ville/quartier, formation, KYC) — uniquement la robustesse de chargement.
- Pas de conversion JSX → TSX (interdit par les règles projet).

# Détails techniques

Fichier touché : `src/pages/CatalogueVendeur.jsx` uniquement.

```text
CategoriesGrid
├─ queryFn: 2 requêtes parallèles (categories + produits[id,categorie_id,actif])
├─ reduce → Map<categorie_id, count>
├─ retry: 2, staleTime: 30s
├─ isError → écran erreur + bouton Réessayer
└─ useEffect: supabase.channel('catalog_rt')
              .on(postgres_changes, table=produits)  → invalidate
              .on(postgres_changes, table=categories)→ invalidate

ProduitsParCategorie
├─ même retry/staleTime override
└─ même isError UI
```

Vérification après implémentation : tester le chemin "vendeur déjà connecté → ouvre CatalogueVendeur → coupe réseau brièvement → rétablit" pour confirmer que le grid se rétablit automatiquement.
