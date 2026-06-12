## Constat

Le déblocage par une seule vidéo existe toujours côté backend, mais le chemin pour y arriver est cassé pour un nouveau vendeur.

**Ce qui débloque encore correctement :** `VideoFormation.jsx` (case "j'ai regardé" + acceptation conditions → `training_completed = true` + `catalogue_debloque = true`).

**Ce qui est cassé :** sur le tableau de bord vendeur (`EspaceVendeur.jsx`, lignes 758-772), le bouton **Catalogue** est rendu inactif (gris, `disabled`) quand `training_completed` est `false` via `canAccessFeature(...)`. Le vendeur ne peut donc **plus cliquer dessus** pour atteindre l'écran « 🔒 Catalogue non débloqué » qui contenait le bouton « ▶ Voir la formation » menant à `VideoFormation`.

Pire : la grosse carte juste en dessous (lignes 776-787) « 🎓 Formation & Cours Zonite » route vers `FormationCours` (page multi-vidéos qui **ne déclenche aucun déblocage**). Un nouveau vendeur clique dessus, regarde des vidéos, et le catalogue reste verrouillé sans aucun message.

Résultat : le vendeur est coincé. Avant la mise à jour, le bouton/lien le menait à la vidéo unique qui débloquait tout.

## Correction proposée

Dans `src/pages/EspaceVendeur.jsx` uniquement (zéro changement de logique métier, zéro migration) :

1. **Bouton Catalogue** : quand `training_completed` est `false` mais que le compte est sinon utilisable (`seller_status` ∈ active_seller / kyc_required / kyc_pending), le rendre **cliquable** et le faire pointer vers `VideoFormation` (pas vers `CatalogueVendeur` désactivé). Garder le rendu jaune actuel + une petite mention « ▶ Visionner la formation » à la place de « produits » pour qu'on comprenne pourquoi on est redirigé. Aucun changement visuel pour les vendeurs déjà actifs.

2. **Bouton Nouvelle commande** : même règle — pointer vers `VideoFormation` plutôt que rester inerte. Pas de raison d'inviter à passer commande tant que la formation n'est pas faite, mais on ne laisse pas un bouton mort.

3. **Carte « Formation & Cours Zonite »** : si `training_completed` est `false`, faire pointer le lien vers `VideoFormation` (vidéo de déblocage). Sinon garder `FormationCours` comme aujourd'hui (centre de formation continue). Aucun changement de design.

Aucun changement sur `CatalogueVendeur.jsx` (l'écran 🔒 reste un filet de sécurité), `VideoFormation.jsx`, `SellerStatusEngine.jsx`, ni la base.

## Détails techniques

- Fichier modifié : `src/pages/EspaceVendeur.jsx`
- Remplacer les blocs `<button disabled>` (lignes 750-757 et 765-772) par des `<Link to={createPageUrl("VideoFormation")}>` reprenant exactement le style actuel des versions actives (bleu `#1a1f5e` pour Nouvelle commande, jaune `#F5C518` pour Catalogue) afin de ne pas modifier la mise en page.
- Modifier la cible du `<Link to={createPageUrl("FormationCours")}>` (ligne 776) en :
  ```jsx
  <Link to={createPageUrl(compteVendeur.training_completed ? "FormationCours" : "VideoFormation")}>
  ```
- Vérifier que les 169 tests Vitest passent (audit-03 et audit-19 couvrent cette zone).

## Hors scope

- Pas de changement de la règle DB (training_completed reste positionné par VideoFormation).
- Pas de modification de `canAccessFeature` ni de `FormationCours` (centre de formation continue conservé tel quel).
- Pas de nouveau message KYC (KYC ne bloque toujours pas le catalogue, conformément au commentaire en place).