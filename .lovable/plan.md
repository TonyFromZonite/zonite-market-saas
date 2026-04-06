

# Ajouter le lien "Mot de passe oublié" sur l'écran de verrouillage

## Modification

**Fichier** : `src/components/AppLockScreen.jsx`

Quand le mot de passe est incorrect (`passError` non vide), afficher en dessous du message d'erreur un lien "Mot de passe oublié ?" qui redirige vers `/MotDePasseOublie` (même destination que sur la page de connexion).

## Détails techniques

1. Après le bloc `{passError && ...}` (ligne ~262), ajouter un texte + lien visible uniquement quand `passError` est non vide
2. Le lien fait `window.location.href = "/MotDePasseOublie"` (on quitte l'écran de verrouillage)
3. Style : texte petit, couleur blanche/dorée, discret mais cliquable

