

# Fix : le lien "Mot de passe oublié" ne fonctionne pas depuis l'écran de verrouillage

## Problème identifié

Quand l'utilisateur clique sur "Mot de passe oublié ?", `window.location.href = "/MotDePasseOublie"` recharge la page. Au rechargement, `AppWithRouter` détecte une session + biométrie activée dans localStorage → remet `locked = true` → réaffiche l'écran de verrouillage au lieu de la page mot de passe oublié.

C'est une boucle : lock → clic → reload → lock → même écran.

## Solution

**Fichier** : `src/components/AppLockScreen.jsx`

Au lieu de `window.location.href`, appeler `onUnlock("/MotDePasseOublie")` qui :
1. Met `locked = false` dans `AppWithRouter`
2. Navigue vers `/MotDePasseOublie` via React Router

Le handler `onUnlock` dans `App.jsx` (ligne 135) accepte déjà un `targetPath` et fait exactement ça.

Changement concret — ligne 264 :
```jsx
// Avant
onClick={() => { window.location.href = "/MotDePasseOublie"; }}

// Après  
onClick={() => { onUnlock("/MotDePasseOublie"); }}
```

Aucun autre fichier à modifier.

