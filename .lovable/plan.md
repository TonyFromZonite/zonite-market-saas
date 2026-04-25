# Fix : Impossible de supprimer le produit "Ventilateur de poche" (VP001)

## Cause identifiée

Le produit `VP001` (id `29b9e51d-...`) est référencé dans :
- **8 ventes**
- **16 commandes vendeur**
- **20 mouvements de stock**

La requête `DELETE FROM produits WHERE id = ...` échoue (ou le toast d'erreur est peu visible) car supprimer le produit casserait l'historique comptable. C'est une protection saine — on ne doit jamais supprimer un produit qui a généré des ventes.

## Solution — Soft delete intelligent

### Fichier modifié : `src/pages/Produits.jsx` (fonction `supprimer`, lignes 129-142)

Nouvelle logique :

1. **Avant de supprimer**, on vérifie via 2 requêtes `count` (`ventes`, `commandes_vendeur`) si le produit a un historique.
2. **Si historique = 0** → vraie suppression `DELETE` (produit jamais utilisé, ex. erreur de saisie).
3. **Si historique > 0** → on fait `UPDATE produits SET actif = false` à la place. Le produit disparaît du catalogue vendeur mais reste accessible pour l'historique.
4. **Toast clair** dans chaque cas :
   - Suppression réelle : *"Produit supprimé définitivement"*
   - Désactivation : *"Ce produit a un historique de ventes. Il a été désactivé (masqué du catalogue) pour préserver les données comptables."*
5. **Améliorer la gestion d'erreur** : afficher `err.message` complet (le code actuel le fait déjà, mais on s'assure que l'erreur Supabase remonte bien).

### Bonus UX (optionnel, à valider)

- Dans la liste des produits, ajouter un petit badge gris "Désactivé" sur les produits avec `actif = false`.
- Permettre la **réactivation** depuis le bouton d'édition (toggle `actif`).

## Aucune modification de la base de données nécessaire

La colonne `actif` existe déjà sur la table `produits` (default `true`). Aucun migration SQL.

## Résumé

| Avant | Après |
|---|---|
| Clic sur Supprimer → erreur silencieuse, le produit reste | Clic sur Supprimer → produit désactivé (si historique) ou supprimé (si vierge) avec message clair |
