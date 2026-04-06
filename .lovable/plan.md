

# Ajouter les statistiques vendeurs avec filtre par periode

## Ce qui sera fait

Apres la barre de recherche dans `ListeVendeurs`, ajouter une section avec :
- Un selecteur de periode : **1 mois**, **6 mois**, **1 an**, **Global**
- 3 cartes statistiques :
  - **Total vendeurs** (inscrits dans la periode)
  - **Vendeurs actifs** (`seller_status === "active_seller"` et `created_at` dans la periode)
  - **Vendeurs inactifs** (tous les autres statuts dans la periode)

## Fichier modifie

| Fichier | Modification |
|---------|-------------|
| `src/pages/Vendeurs.jsx` | Ajouter filtre periode + 3 cartes stats entre la recherche (ligne 135) et le tableau (ligne 136) |

## Implementation

Dans `ListeVendeurs`, apres le champ de recherche :

1. Ajouter un state `periode` (`"1m"`, `"6m"`, `"1a"`, `"global"`)
2. Calculer a partir du tableau `vendeurs` deja charge (pas de requete supplementaire) :
   - Filtrer par `created_at` selon la periode selectionnee
   - Compter les actifs (`seller_status === "active_seller"`) et inactifs (le reste)
3. Afficher 3 cartes avec icones : Total (Users), Actifs (CheckCircle2 vert), Inactifs (XCircle rouge)
4. Le selecteur de periode sera un groupe de boutons compacts (toggle style)

Les donnees sont calculees cote client a partir des vendeurs deja recuperes — aucune requete supplementaire.

