

# Fix : Masquer la barre de navigation vendeur sur la page Mot de passe oublié

## Problème

Quand le vendeur arrive sur `/MotDePasseOublie` depuis l'écran de verrouillage, sa session vendeur est encore active. Le Layout détecte `vendeurSession` → considère la page comme une page vendeur → affiche la barre de navigation du bas (Accueil, Commandes, etc.) car `MotDePasseOublie` n'est pas dans la liste des pages vendeur sans navigation.

## Solution

**Fichier** : `src/Layout.jsx`

Ajouter `"MotDePasseOublie"` et `"ResetPassword"` à la liste `PAGES_VENDEUR_SANS_NAV` (ligne 9-11). Ces pages ne doivent jamais afficher la barre de navigation vendeur.

```js
// Avant
const PAGES_VENDEUR_SANS_NAV = new Set([
  "InscriptionVendeur", "EnAttenteValidation", "Connexion",
]);

// Après
const PAGES_VENDEUR_SANS_NAV = new Set([
  "InscriptionVendeur", "EnAttenteValidation", "Connexion",
  "MotDePasseOublie", "ResetPassword",
]);
```

Aucun autre fichier à modifier.

