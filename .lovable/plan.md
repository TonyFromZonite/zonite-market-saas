## Problème

Dans **Admin → Vendeurs**, la colonne **CA Généré** affiche actuellement `v.total_commissions_gagnees` (le cumul des commissions vendeur, en FCFA gagnés), ce qui n'est **pas** le chiffre d'affaires. Le CA doit être la somme totale de `ventes.montant_total` générée par ce vendeur **depuis la création de son compte** (cumul à vie).

## Correctif

Fichier unique : `src/pages/Vendeurs.jsx`

1. **Étendre la requête `ventes_stats`** pour récupérer aussi `montant_total` :
   ```js
   .select("vendeur_id, montant_total, created_at")
   ```
2. **Calculer un map cumulé par vendeur** avec `useMemo` (toutes les ventes, pas de filtre période — "depuis la création du compte" = total à vie) :
   ```js
   const caParVendeur = useMemo(() => {
     const m = new Map();
     for (const v of ventes) {
       m.set(v.vendeur_id, (m.get(v.vendeur_id) || 0) + Number(v.montant_total || 0));
     }
     return m;
   }, [ventes]);
   ```
3. **Remplacer la cellule** ligne 297 :
   ```jsx
   <TableCell className="text-right font-medium">
     {formater(caParVendeur.get(v.id) || 0)}
   </TableCell>
   ```

## Hors-scope (non modifié)

- Le filtre période (1m / 6m / 1a / Global) continue de piloter uniquement les compteurs Actifs/Inactifs comme aujourd'hui — la colonne CA reste sur le cumul à vie tel que demandé.
- La colonne **Solde Commission** (`v.solde_commission`) reste inchangée.
- Aucun changement SQL/RLS : la table `ventes` est déjà lue par cette requête, on ajoute juste `montant_total` au `select`.

## Vérification

- Build auto + relecture visuelle de la colonne dans la liste vendeurs (les valeurs doivent désormais correspondre à la somme `montant_total` de la table `ventes` pour chaque vendeur, identique à ce qui est affiché côté vendeur dans son tableau de bord "Total vendu").