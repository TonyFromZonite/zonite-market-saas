

# Correction des warnings React (refs + Router v7 flags)

## Warnings identifies

1. **`NotificationManager` ref warning** : `AppWithRouter` passe implicitement un ref a `NotificationManager` qui est un composant fonction sans `forwardRef`.
2. **`TikTokIcon` ref warning** : Dans `Connexion.jsx`, le composant SVG `TikTokIcon` recoit un ref (probablement via un wrapper `<a>` ou parent) sans `forwardRef`.
3. **React Router v7 future flags** : Warnings `v7_startTransition` et `v7_relativeSplatPath` emis par `BrowserRouter`.

## Corrections

### 1. `NotificationManager` — ajouter `forwardRef`
**Fichier** : `src/components/NotificationManager.jsx`
- Wrapper le composant avec `React.forwardRef` pour accepter silencieusement le ref sans erreur.

### 2. `TikTokIcon` — ajouter `forwardRef`
**Fichier** : `src/pages/Connexion.jsx`
- Wrapper `TikTokIcon` avec `React.forwardRef` et propager le ref sur le `<svg>`.

### 3. React Router v7 future flags
**Fichier** : `src/App.jsx`
- Ajouter les props `future={{ v7_startTransition: true, v7_relativeSplatPath: true }}` sur `<BrowserRouter>`.

## Fichiers modifies

| Fichier | Modification |
|---------|-------------|
| `src/components/NotificationManager.jsx` | `forwardRef` wrapper |
| `src/pages/Connexion.jsx` | `forwardRef` sur `TikTokIcon` |
| `src/App.jsx` | Future flags sur `BrowserRouter` |

