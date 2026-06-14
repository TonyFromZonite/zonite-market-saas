## Cause du bug

Message reçu par le vendeur : `Option "Bleu ciel" inconnue pour la variation "COULEURS" du produit.`

Le trigger SQL `validate_commande_variation` compare **strictement** (sensible à la casse et aux espaces) le couple `Nom:Valeur` de la commande contre la définition `produits.variations`.

Or, après ta modification :
- les définitions actuelles contiennent par ex. `nom:"couleur"` / `value:"bleu ciel"` ou `value:"Bleu Ciel"`,
- mais les **clés stockées dans `produits.stocks_par_coursier[].stock_par_variation[].variation_key`** (anciennes) gardent l'ancienne casse `COULEURS:Bleu ciel`.
- Le sélecteur côté vendeur (`SelecteurLocalisation.jsx`) propose ces `variation_key` brutes → la commande envoie `COULEURS:Bleu ciel` → le trigger rejette.

Exemples vérifiés en BD :
- Matelas RIYANA 140x200 : `nom:"COULEUR"`, option `"Blanc et bleu ciel"`
- Matelas RIYANA 180x200 : `nom:"couleur"`, option `"Bleu Ciel"`
- Matelas RIYANA 120x190 : `nom:"couleur"`, option `"bleu ciel"`

## Correction (2 volets, en migration SQL uniquement, zéro changement front)

### 1. Trigger tolérant à la casse / espaces

Mettre à jour `public.validate_commande_variation()` pour comparer `lower(trim(...))` côté commande et côté définition produit. Comportement métier identique, juste plus robuste face aux renommages d'admin.

### 2. Réaligner les `variation_key` historiques

Script SQL one-shot qui parcourt `produits.stocks_par_coursier` et réécrit chaque `variation_key` en utilisant le `Nom`/`value` actuels de `produits.variations` lorsqu'un match insensible à la casse est trouvé. Comme ça la clé en stock = clé en définition = clé envoyée par la commande.

## Hors périmètre

- Pas de changement à `SelecteurLocalisation.jsx`, `NouvelleCommandeVendeur.jsx`, `CommandesVendeurs.jsx`.
- Pas de modification du format d'enregistrement (`Nom:Valeur` séparés par `|`).
- Pas de touche à l'auth, KYC, RLS, ou autres triggers.

## Vérification

- Tenter à nouveau la commande qui échouait → doit passer.
- Lancer `bunx vitest run` (les 169 tests existants doivent rester verts, en particulier `audit-22-variation-alerte-livraison`).
- Vérifier en BD qu'une commande de test insère bien la ligne avec la variation.
