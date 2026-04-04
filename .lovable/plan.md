# Plan : Refonte du formulaire commande vendeur + filtrage coursier admin

## Contexte

Actuellement, dans `NouvelleCommandeVendeur.jsx`, ville et quartier sont des `<Select>` (listes déroulantes). Le vendeur voit et choisit un coursier spécifique. Or, l'attribution du coursier est une responsabilité admin. Le vendeur doit seulement voir une estimation des frais de livraison.

Coté admin (`GestionCommandes.jsx`), le filtrage des coursiers se fait par ville mais pas par quartier/zone.

## Changements prévus

### 1. NouvelleCommandeVendeur.jsx — Champs ville/quartier en texte libre avec autocomplétion

- Remplacer les deux `<Select>` (ville et quartier) par des `<Input>` avec liste de suggestions (`datalist` ou dropdown filtré).
- Quand le vendeur tape, filtrer les villes/quartiers existants et afficher des suggestions.
- Si la valeur tapée ne correspond à aucune entrée existante, le vendeur peut quand même soumettre (texte libre).
- Stocker `client_ville` et `client_quartier` comme texte brut (ce qui est déjà le cas dans la table `commandes_vendeur`).

### 2. NouvelleCommandeVendeur.jsx — Estimation prix livraison au lieu du choix de coursier

- Supprimer complètement la sélection de coursier coté vendeur.
- Ne plus enregistrer `coursier_id` dans la commande coté vendeur (laisser `null`, l'admin l'attribuera).
- Supprimer la validation de stock par coursier (le vendeur ne sait pas quel coursier sera attribué).
- Afficher à la place une estimation des frais de livraison :
  - Si la ville ET le quartier existent dans notre base → trouver la zone de livraison correspondante → afficher la fourchette min-max des frais des coursiers couvrant cette zone.
  - Si seule la ville existe → afficher la fourchette des frais de tous les coursiers de cette ville.
  - Si ni la ville ni le quartier n'existent → afficher "Estimation : 1 500 FCFA" par défaut.
- Format affiché : "Estimation livraison : 1 000 — 1 500 FCFA" (min et max).

### 3. NouvelleCommandeVendeur.jsx — Validation stock simplifiée

- Valider le stock global du produit (pas par coursier, puisque le coursier n'est pas encore choisi mais par la  verification du  stock existe  a l'un des coursier  dans cette ville. la validation de stock cote vendeur ce fait dons par ville.  et l'admin choisira lui meme un coursier qui a le stock.).
- L'admin réservera le stock quand il attribuera le coursier.

### 4. GestionCommandes.jsx — Filtrage coursier par ville ET quartier/zone

- Dans `findCoursiersForCommande`, après avoir trouvé la ville :
  - Chercher le quartier dans la table `quartiers`.
  - Trouver quelle `zone_livraison` contient ce quartier (via `quartiers_ids`).
  - Filtrer les coursiers dont `zones_livraison_ids` inclut cette zone.
  - Si aucun match par quartier, fallback sur tous les coursiers de la ville.
  - Si aucun match par ville, fallback sur tous les coursiers actifs.

### 5. SelecteurLocalisation.jsx — Aucun changement nécessaire

Ce composant est utilisé par `FormulaireVente.jsx` (formulaire admin de vente directe), pas par le formulaire vendeur. Il reste inchangé.

## Fichiers modifiés


| Fichier                                 | Action                                                                                    |
| --------------------------------------- | ----------------------------------------------------------------------------------------- |
| `src/pages/NouvelleCommandeVendeur.jsx` | Refonte ville/quartier en texte libre + estimation livraison + suppression choix coursier |
| `src/pages/GestionCommandes.jsx`        | Filtrage coursier par quartier/zone en plus de la ville                                   |


## Résumé fonctionnel

- **Vendeur** : tape la ville et le quartier librement (avec suggestions), voit une estimation du prix de livraison (fourchette min-max), ne choisit pas de coursier mais verifie   que le stock existe bien et belle a l'un des coursier  dans cette ville. la validation de stock cote vendeur ce fait dons par ville.  et l'admin choisira lui meme un coursier qui a le stock.
- **Admin** : lors de l'attribution, voit en priorité les coursiers dont la zone couvre le quartier du client, puis ceux de la ville, puis tous en dernier recours.
- **Défaut** : si ville/quartier inconnus → estimation à 1 500 FCFA.