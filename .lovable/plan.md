

# Correction : masquer la barre de navigation vendeur sur la page d'inscription

## Problème

Dans `Layout.jsx`, la page `InscriptionVendeur` fait partie de `PAGES_VENDEUR`, ce qui déclenche l'affichage de `VendeurBottomNav` même quand l'utilisateur n'est pas connecté.

## Solution

Dans `Layout.jsx`, modifier la condition d'affichage du layout vendeur pour exclure les pages pré-authentification (`InscriptionVendeur`, `EnAttenteValidation`, `Connexion`) de l'affichage de `VendeurBottomNav`.

Concrètement, ajouter un set `PAGES_VENDEUR_SANS_NAV` contenant `InscriptionVendeur` et `EnAttenteValidation`, et ne rendre `VendeurBottomNav` que si la page n'est pas dans ce set ET qu'une session vendeur existe.

## Fichier modifié

| Fichier | Action |
|---------|--------|
| `src/Layout.jsx` | Conditionner l'affichage de VendeurBottomNav à l'existence d'une session vendeur et à l'exclusion des pages pré-auth |

