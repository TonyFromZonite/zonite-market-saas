## Objectif

Dans `NouvelleCommandeVendeur.jsx` :
1. Afficher un message d'erreur rouge explicite (mentionnant le nom de la variation : « Couleur », « Taille »…) si le vendeur clique sur « Envoyer la commande » sans avoir sélectionné toutes les variations requises.
2. Si la quantité est ≥ 2, permettre au vendeur de cocher plusieurs options d'une même variation (ex : Rouge + Bleu pour 2 articles). Chaque option cochée génère une commande séparée à l'envoi.

Aucune migration de base de données : on crée plusieurs lignes dans `commandes_vendeur`, une par option sélectionnée.

## Changements

### 1. Message rouge explicite par variation manquante

- Remplacer la validation ligne 302 par une boucle sur `variations` qui collecte les noms non sélectionnés.
- Si liste non vide : `setErreur("Veuillez sélectionner : " + noms.join(", ") + " avant d'envoyer la commande.")` — le bloc rouge existant (lignes 410-414) l'affiche déjà.
- Ajouter un sous-bloc rouge inline sous chaque variation non sélectionnée après tentative d'envoi (état `tentativeEnvoi`) pour pointer visuellement la variation manquante : « Sélectionnez au moins une {nom} ».

### 2. Multi-sélection si quantité > 1

- Passer `selectedVariations[v.nom]` d'une string à un **tableau** quand `qte > 1`. Pour rester rétro-compatible, on garde une string quand `qte === 1`.
- Helper local `getSelectedArray(v.nom)` qui renvoie toujours un tableau.
- Au clic d'une option :
  - Si `qte === 1` : comportement actuel (remplace).
  - Si `qte > 1` : toggle (ajoute/retire de la liste). Limiter le nombre total d'options cochées sur l'ensemble des variations à `qte` (info inline « X / qte sélectionnés »).
- UI : ajouter une coche ✓ sur les chips/cards sélectionnées, et un compteur sous le label de chaque variation quand `qte > 1` : « Sélectionnez jusqu'à {qte} options ».
- Quand `qte` change et tombe à 1, on garde uniquement la première option de chaque variation.

### 3. Construction des commandes à l'envoi

- Si `qte === 1` ou aucune variation multi-cochée : 1 seul `insert` (comportement actuel).
- Sinon : générer le **produit cartésien** des sélections multi-options par variation et insérer une ligne `commandes_vendeur` par combinaison, avec :
  - `quantite` = répartition simple : pour M combinaisons et qte Q, on alloue `floor(Q/M)` à chacune et on ajoute le reste à la première.
  - `variation` = clé `Nom1:Val1|Nom2:Val2` de la combinaison.
  - Même client, même prix, même `reference_commande` suffixé `-1`, `-2`, … pour traçabilité.
- Stock check par combinaison via `isOptionAvailableInCoursiers` (déjà utilisé) avant insert ; bloque toute la commande si une combinaison est en rupture.
- Une seule notification admin agrégée : « X commandes (Rouge×1, Bleu×2) … ».

### 4. Recalcul effectivePrices / displayImage

- `effectivePrices` et `displayImage` continuent d'utiliser une sélection « représentative » (première option de chaque variation) pour l'aperçu et le calcul de commission — précisé par une note discrète sous le récapitulatif quand multi-sélection active.

## Fichiers touchés

- `src/pages/NouvelleCommandeVendeur.jsx` (seul fichier modifié)
- Aucun changement de schéma DB, aucun edge function.

## Hors scope

- Aucune modification de `Produits.jsx`, `Commandes.jsx`, `GestionCommandes.jsx` : ces vues affichent déjà une commande par ligne, donc les N lignes générées s'y intègrent sans changement.
- Pas de support multi-sélection dans `FormulaireVente.jsx` (admin) — uniquement côté vendeur comme demandé.
