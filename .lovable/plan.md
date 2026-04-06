

# Corriger les statistiques vendeurs (actifs/inactifs par livraisons)

## Problemes

1. **Logique actif/inactif incorrecte** : Actuellement basee sur `seller_status === "active_seller"` et filtree par `created_at` du vendeur. La bonne logique : un vendeur est **actif** dans une periode s'il a au moins une vente (livraison validee) dans cette periode.

2. **Total vendeurs filtre par date d'inscription** : Le total ne devrait pas etre filtre par date d'inscription. Il faut montrer le total global de vendeurs, puis parmi eux combien sont actifs/inactifs selon les livraisons dans la periode.

3. **Liste vendeurs vide** : Les requetes reseau retournent `[]` — probablement un probleme de donnees ou de session admin. A verifier apres le fix.

## Nouvelle logique

- **Total** : tous les vendeurs inscrits (pas de filtre periode)
- **Actif** : vendeur avec au moins 1 enregistrement dans la table `ventes` dont `created_at` est dans la periode selectionnee
- **Inactif** : Total - Actifs

## Modifications

| Fichier | Changement |
|---------|-----------|
| `src/pages/Vendeurs.jsx` | Ajouter une requete `ventes` (vendeur_id + created_at), recalculer les stats basees sur les livraisons |

## Implementation

1. Ajouter une query React Query pour recuperer les ventes : `select("vendeur_id, created_at")` depuis la table `ventes`
2. Dans le `useMemo` stats :
   - `total` = nombre total de vendeurs (sans filtre periode)
   - Filtrer les ventes par `created_at >= dateMin`
   - Extraire les `vendeur_id` uniques ayant des ventes dans la periode → actifs
   - `inactifs` = total - actifs
3. Le tableau vendeurs continue d'afficher tous les vendeurs (pas de filtre par periode sur la liste)

