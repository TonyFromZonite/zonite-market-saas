## Objectif

Quand un vendeur passe une commande avec variation (ex. couleur + taille), l'admin doit voir précisément la variation dans `CommandesVendeurs.jsx`, et le bouton **« Copier les infos de la commande »** doit inclure ces variations + la quantité pour transmission claire à l'agence de livraison.

## Constat actuel

Dans `src/pages/CommandesVendeurs.jsx` :

- La variation (`commande.variation`, ex. `"Couleur:Rouge|Taille:M"`) est stockée en BD mais n'est affichée ni dans la liste des commandes, ni dans le modal de détail.
- La fonction `copierInfosCommande` (lignes 15–54) génère le texte copié sans la variation ni la quantité — l'agence de livraison ne sait donc pas quelle variante préparer.

## Modifications (frontend uniquement, `src/pages/CommandesVendeurs.jsx`)

1. **Helper de formatage** (en haut du fichier)
   - Ajouter `formatVariation(raw)` qui parse `"Couleur:Rouge|Taille:M"` (ou `" / "`) et renvoie un libellé lisible `"Couleur : Rouge, Taille : M"`.

2. **`copierInfosCommande(cmd)`** — enrichir le texte copié
   - Ajouter la ligne `Quantité : <n>`.
   - Si `cmd.variation` existe, ajouter `Variantes : <formatVariation(...)>` juste après le nom du produit.
   - Conserver le reste (nom, adresse, téléphone, montant, notes) inchangé.

3. **Liste des commandes (ligne ~574)**
   - Sous le nom du produit, afficher en petit `Variante : Couleur : Rouge, Taille : M` quand `c.variation` est défini.

4. **Modal de détail (grille à la ligne ~615)**
   - Ajouter une cellule `Variante` (col-span-2 si présente) à côté de Quantité, affichant `formatVariation(commandeSelectionnee.variation)`.

5. **Message vendeur à la livraison (ligne ~335)**
   - Inclure la variante dans le message de confirmation envoyé au vendeur (`📦 Produit : ... (Couleur : Rouge, Taille : M)`).

## Hors périmètre

- Pas de changement à la création de commande (`NouvelleCommandeVendeur.jsx`) — le format stocké reste identique.
- Pas de modification SQL/RLS/triggers.
- Pas de toucher à l'auth, KYC, ou logique métier.
- Aucune nouvelle fonctionnalité, juste l'affichage et le texte copié.

## Vérification

- Lancer `bunx vitest run` pour s'assurer qu'aucun des 169 tests existants ne casse.
- Vérifier visuellement dans le preview qu'une commande avec variation affiche bien la variante et que le bouton Copier inclut la ligne `Variantes`.
