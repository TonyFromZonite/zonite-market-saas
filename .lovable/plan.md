

# Fix : Le classement vendeurs ne montre rien pour un nouveau vendeur

## Problème identifié

La table `ventes` a une politique RLS qui restreint chaque vendeur à ne voir **que ses propres ventes** :
```
"Sellers view own ventes" → vendeur_id = get_seller_id_for_user(auth.uid())
```

La requête du classement (top vendeurs) essaie de charger **toutes les ventes de tous les vendeurs** pour construire le ranking. Mais grâce au RLS, un vendeur ne reçoit que ses propres données. Résultat : un nouveau vendeur avec 0 ventes voit un classement totalement vide.

Les stats personnelles (CA semaine, mois) affichent correctement "0 FCFA" — c'est normal pour un nouveau vendeur sans ventes.

## Solution

Créer une **fonction base de données `SECURITY DEFINER`** qui calcule le classement agrégé sans exposer les données individuelles des ventes.

### Étape 1 — Migration : créer la fonction `get_top_vendeurs`

```sql
CREATE OR REPLACE FUNCTION public.get_top_vendeurs(_since timestamptz)
RETURNS TABLE(vendeur_id uuid, full_name text, total numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT v.vendeur_id, s.full_name, SUM(v.montant_total) AS total
  FROM public.ventes v
  JOIN public.sellers s ON s.id = v.vendeur_id
  WHERE v.created_at >= _since
  GROUP BY v.vendeur_id, s.full_name
  ORDER BY total DESC
  LIMIT 10;
$$;
```

Cette fonction s'exécute avec les droits du propriétaire (bypass RLS) et retourne uniquement des données agrégées (nom + total CA) — pas de données sensibles.

### Étape 2 — Modifier `EspaceVendeur.jsx`

Remplacer les 3 requêtes directes sur `ventes` dans la section "Top vendeurs" par 3 appels RPC :

```js
const [topWeek, topMonth, topYear] = await Promise.all([
  supabase.rpc('get_top_vendeurs', { _since: startOfWeek.toISOString() }),
  supabase.rpc('get_top_vendeurs', { _since: startOfMonth.toISOString() }),
  supabase.rpc('get_top_vendeurs', { _since: startOfYear.toISOString() }),
]);

return {
  topWeek: topWeek.data || [],
  topMonth: topMonth.data || [],
  topYear: topYear.data || [],
};
```

Plus besoin de fetch les sellers séparément ni de grouper côté client — la fonction fait tout.

### Étape 3 — Adapter `ClassementHebdo.jsx`

Le composant reçoit déjà `topVendeurs` avec des objets `{ vendeur_id, full_name, total }`. Seul changement mineur : la propriété `email` n'existera plus, mais le composant utilise déjà `v.full_name` en priorité (ligne 51), donc rien à changer sauf retirer le fallback `v.email?.split('@')[0]`.

## Résumé des fichiers modifiés

1. **Migration SQL** — nouvelle fonction `get_top_vendeurs`
2. **`src/pages/EspaceVendeur.jsx`** — remplacer les requêtes directes par `supabase.rpc('get_top_vendeurs', ...)`
3. **`src/components/ClassementHebdo.jsx`** — retirer le fallback email (optionnel, mineur)

