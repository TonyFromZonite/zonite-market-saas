

# Correction : masquer le menu admin sur les pages de mot de passe

## Problème

Les pages `MotDePasseOublie` et `ResetPassword` ne sont pas listées dans `PAGES_SANS_LAYOUT_ADMIN` dans `Layout.jsx`. Elles reçoivent donc le layout admin complet (sidebar + header) au lieu d'un affichage simple sans navigation.

## Solution

Dans `src/Layout.jsx`, ajouter `"MotDePasseOublie"` et `"ResetPassword"` au set `PAGES_SANS_LAYOUT_ADMIN` (ligne 20-24). Ces pages doivent se comporter comme `"Connexion"` : aucun layout admin, aucune barre vendeur, juste le contenu brut.

## Fichier modifié

| Fichier | Action |
|---------|--------|
| `src/Layout.jsx` | Ajouter `"MotDePasseOublie"` et `"ResetPassword"` à `PAGES_SANS_LAYOUT_ADMIN` |

