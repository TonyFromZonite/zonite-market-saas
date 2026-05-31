## Objectif

Permettre à l'admin, depuis le dialogue de détail d'une commande (`/CommandesVendeurs`), de :
1. Basculer `livraison_incluse` (oui / non) pour la commande courante uniquement.
2. Modifier le montant `frais_livraison` directement dans un champ de saisie, uniquement pour cette commande.
3. Saisir un message libre qui sera envoyé au vendeur en notification expliquant la modification.

Ces changements impactent automatiquement la commission du vendeur (calcul déjà existant côté livraison) et sont tracés dans le journal d'audit.

## Changements

### `src/pages/CommandesVendeurs.jsx`

1. **Nouveaux états locaux** (à côté de `notesAdmin`, `livreurNom`) :
   - `editLivraisonIncluse` (bool)
   - `editFraisLivraison` (string/number)
   - `messageVendeur` (texte du message envoyé au vendeur)
   - `enregistrementLivraison` (bool, loading)

2. **Initialisation** : au clic sur une commande (ligne 473, `onClick`), pré-remplir ces états avec les valeurs actuelles de la commande.

3. **Nouveau bloc UI** dans le dialogue, juste après la grille récap (après ligne 538), titré « Ajuster les frais de livraison » :
   - `Switch` ou paire de boutons radio : « Livraison incluse dans le prix client » / « Livraison en sus »
   - `Input` numérique « Frais de livraison (FCFA) » lié à `editFraisLivraison`
   - `Textarea` « Message au vendeur (obligatoire) »
   - `Button` « Appliquer la modification », désactivé tant que le message est vide ou qu'aucun champ n'a changé.
   - Petite note d'info : « Cette modification s'applique uniquement à cette commande et impactera la commission du vendeur à la livraison. »

4. **Handler `appliquerModificationLivraison`** :
   - `UPDATE commandes_vendeur` avec `{ livraison_incluse, frais_livraison }` pour l'`id` courant.
   - Insertion d'une notification vendeur (`notifications_vendeur`) :
     - `titre` : « Modification des frais de livraison »
     - `message` : message admin + récap (ancien/nouveau frais, statut incluse).
     - `type` : "info"
   - Insertion `journal_audit` (action `Modification frais livraison`, entité = id commande, détails ancien/nouveau).
   - `invalidateQueries(["commandes_vendeurs_admin"])`.
   - Met à jour la commande sélectionnée localement (pour refléter dans le dialogue sans le fermer).

5. **Affichage commission** (ligne 50-58 et 519) : ajuster `commission_calculee` pour soustraire `frais_livraison` quand `livraison_incluse` est vrai, afin d'être cohérent avec le calcul final de `marquerLivree` (lignes 172-173). Sinon l'admin verrait une commission affichée différente de celle réellement créditée.

### Hors-scope

- Aucune modification de schéma DB (les colonnes `livraison_incluse` et `frais_livraison` existent déjà sur `commandes_vendeur`).
- Pas de modification des autres écrans (côté vendeur, dashboard, etc.).
- Pas de changement du calcul de commission lors de la livraison : `marquerLivree` lit déjà ces deux colonnes au moment où la commande passe à `livree`, donc les modifications admin sont automatiquement prises en compte.

## Test

Ajouter à `src/pages/CommandesVendeurs.test.jsx` un test UI qui :
- Ouvre le dialogue d'une commande mockée.
- Vérifie la présence du switch « Livraison incluse », du champ frais, du textarea message.
- Vérifie que le bouton « Appliquer » est désactivé sans message.
- Vérifie qu'après saisie + clic, `supabase.from("commandes_vendeur").update(...)` est appelé avec les bonnes valeurs et qu'une notification vendeur est insérée.
