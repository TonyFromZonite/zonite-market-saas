

# Optimisation de la vitesse de chargement des pages

## Problemes identifies

1. **Auth bloquante** : `AuthenticatedApp` affiche un spinner (`LoadingScreen`) tant que `supabase.auth.getSession()` n'a pas repondu. Chaque navigation commence par ce delai (~300-800ms).

2. **Page Connexion lazy-loaded** : La page d'accueil (`Connexion`) est chargee via `lazy()` — double attente (auth + chunk JS).

3. **Layout charge des donnees admin sur toutes les pages** : 2 requetes Supabase (badges commandes + KYC) s'executent meme quand c'est inutile.

4. **Pas de prefetch des routes frequentes** : Naviguer vers EspaceVendeur ou InscriptionVendeur necessite un aller-retour reseau pour le chunk JS.

## Plan de correction

### 1. Importer Connexion en statique (pas de lazy)
**Fichier** : `src/pages.config.js`
- Remplacer `const Connexion = lazy(...)` par un import statique `import Connexion from './pages/Connexion'`
- La page d'entree se charge immediatement sans attendre le chunk.

### 2. Ne pas bloquer le rendu sur l'auth pour les pages publiques
**Fichier** : `src/App.jsx`
- Les pages `Connexion`, `InscriptionVendeur`, `MotDePasseOublie`, `ResetPassword`, `EnAttenteValidation` n'ont pas besoin d'attendre l'auth.
- Extraire ces routes AVANT le check `isLoadingAuth` pour qu'elles s'affichent instantanement.

### 3. Prefetch des pages vendeur critiques
**Fichier** : `src/pages.config.js`
- Ajouter un prefetch `requestIdleCallback` pour EspaceVendeur et InscriptionVendeur apres le premier rendu.

### 4. Optimiser le Layout pour les pages sans session
**Fichier** : `src/Layout.jsx`
- Les requetes badges (commandes + KYC) sont deja conditionnees par `isSkipAdmin`, mais le composant execute quand meme tous les hooks. Pas de changement necessaire ici — c'est deja optimise.

### 5. Reduire le staleTime du QueryClient pour les donnees critiques
**Fichier** : `src/lib/query-client.js`
- Garder le staleTime a 2min (deja bon). Pas de changement.

## Resume des fichiers modifies

| Fichier | Modification |
|---------|-------------|
| `src/pages.config.js` | Import statique de Connexion + prefetch idle des pages cles |
| `src/App.jsx` | Routes publiques rendues sans attendre l'auth |

## Impact attendu

- Page Connexion : affichage ~500ms plus rapide (pas de lazy + pas d'attente auth)
- InscriptionVendeur : affichage immediat (pas d'attente auth)
- Navigation vers EspaceVendeur : chunk pre-charge en arriere-plan

