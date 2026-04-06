

# Fix : Flash de la page Connexion avant l'affichage de Mot de passe oublié

## Problème

Quand `onUnlock("/MotDePasseOublie")` est appelé, deux choses se passent :
1. `locked = false` → `AuthenticatedApp` se rend immédiatement
2. `navigate("/MotDePasseOublie")` → la navigation se fait au prochain cycle de rendu

Entre les deux, l'app affiche brièvement la route actuelle (qui peut déclencher un affichage de la page Connexion ou de la route par défaut) avant que la navigation vers `/MotDePasseOublie` ne prenne effet.

## Solution

**Fichier** : `src/App.jsx`

Modifier `handleUnlock` pour naviguer **avant** de débloquer, afin que quand le composant se rend, l'URL soit déjà correcte :

```js
const handleUnlock = (targetPath) => {
  if (targetPath) {
    navigate(targetPath, { replace: true });
  } else {
    const adminSession = JSON.parse(localStorage.getItem("admin_session") || "{}");
    const isAdmin = adminSession?.email && (adminSession?.role === "admin" || adminSession?.role === "sous_admin");
    navigate(isAdmin ? "/TableauDeBord" : "/EspaceVendeur", { replace: true });
  }
  // Débloquer après la navigation pour que l'URL soit déjà à jour
  setLocked(false);
};
```

L'idée : `navigate()` met à jour l'URL dans le même tick synchrone. Quand `setLocked(false)` déclenche le re-render, `location.pathname` est déjà `/MotDePasseOublie` → page publique → pas de flash de Connexion.

