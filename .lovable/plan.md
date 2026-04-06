

# Fix : Lenteur de l'application depuis les dernières modifications

## Diagnostic

L'app n'est pas "lente" à cause d'un bug unique, mais d'une accumulation de requêtes excessives :

1. **TableauDeBord** : 7 queries avec `refetchInterval` de 30-60s, chacune rechargeant des centaines de lignes
2. **EspaceVendeur** : 2 queries avec `refetchInterval: 60s` + 2 abonnements Realtime + le `useCachedQuery` custom (double couche de cache par-dessus React Query)
3. **NotificationManager** : polling HEAD + GET toutes les ~75s sur `notifications_admin`
4. **Double cache** : `useCachedQuery` (CacheManager) fait du cache localStorage en plus de React Query qui cache déjà en mémoire — les deux se marchent dessus

## Solution — Réduire les requêtes sans changer l'UX

### Fichier 1 : `src/pages/TableauDeBord.jsx`

- Augmenter `REFRESH` de 60s a **120s** (2 min)
- Les 2 queries `candidatures` et `kyc` passent de 30s a **120s** aussi
- Ajouter `staleTime: 60 * 1000` aux queries candidatures/kyc (éviter re-fetch immédiat au focus)

### Fichier 2 : `src/pages/EspaceVendeur.jsx`

- Supprimer `refetchInterval: 60 * 1000` des queries `COMPTE_VENDEUR_FRESH` et `vendeur_stats` — les abonnements Realtime gèrent déjà le rafraîchissement en temps réel via `invalidateQueries`
- Le polling + Realtime en même temps est redondant et double le nombre de requêtes

### Fichier 3 : `src/components/NotificationManager.jsx`

- La fonction `checkMissedNotifications` fait une requête GET complète à chaque retour d'onglet. Ajouter un debounce de 30s pour éviter les rafales quand l'utilisateur alterne rapidement entre onglets.

## Résumé de l'impact

- **Avant** : ~15-20 requêtes/minute en arrière-plan
- **Après** : ~5-8 requêtes/minute, sans perte de réactivité (Realtime couvre les mises à jour critiques)

Aucune modification de la base de données, aucun changement d'UX.

