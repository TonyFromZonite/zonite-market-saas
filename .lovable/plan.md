
Objectif: rétablir l’affichage des données admin sur le site publié en corrigeant le décalage entre session locale, rôle backend et moment où les requêtes démarrent.

Constat probable
- Les logs montrent que la connexion réussit bien, donc le problème n’est probablement pas le mot de passe.
- Les règles d’accès backend lisent uniquement `user_roles` via `has_role()` / `is_admin_or_sous_admin()`.
- Or le login admin dans `src/pages/Connexion.jsx` fait encore partiellement confiance à `user_metadata.role` et au `localStorage`. Résultat possible : l’utilisateur entre dans l’interface admin, mais le backend ne le considère pas comme admin, donc les requêtes renvoient 0 ligne.
- En plus, plusieurs pages admin lancent leurs requêtes trop tôt, avant que l’auth soit totalement restaurée, puis convertissent silencieusement les erreurs en tableaux vides. En production, ce cas est plus visible après un rechargement froid.

Plan d’implémentation
1. Fiabiliser l’état d’authentification global
- Mettre à jour `src/lib/AuthContext.jsx` pour initialiser l’app avec `supabase.auth.getSession()` au lieu de dépendre seulement de `getUser()`.
- Exposer un vrai drapeau `isAuthReady`.
- Garder `onAuthStateChange` uniquement pour la synchro ensuite, sans `await` dans le callback.

2. Faire de `user_roles` la seule source de vérité pour l’admin
- Modifier `src/pages/Connexion.jsx` pour toujours relire `user_roles` en mode admin, même si `user_metadata.role` contient déjà `admin`.
- Refuser l’accès admin si aucun rôle backend `admin` ou `sous_admin` n’est trouvé.
- Pour un sous-admin, vérifier aussi le statut `actif` avant de créer la session locale.

3. Bloquer les requêtes admin tant que l’auth n’est pas prête
- Ajouter un helper/hook du type `useAdminAccess` basé sur `isAuthReady` + rôle backend.
- Brancher `enabled: isAuthReady && isAdminOrSousAdmin` sur les pages critiques : `TableauDeBord`, `Vendeurs`, `Produits`, `Commandes`, `SupportAdmin`, `GestionAdmins`, `ConfigurationApp`, `NotificationCenter`, `useSousAdminPermissions`.

4. Ne plus masquer les erreurs d’autorisation
- Adapter `src/lib/supabaseHelpers.js` pour ne plus transformer silencieusement les erreurs RLS/auth en `[]` sur les données protégées.
- Afficher un état explicite du type “session expirée” ou “droits admin introuvables” au lieu d’une page vide.

5. Forcer un refetch propre après reconnexion
- Invalider React Query et les caches locaux quand la session devient prête.
- Ajuster les requêtes protégées pour refetch après montage/reconnexion afin qu’un premier fetch trop tôt ne bloque pas durablement l’interface sur des données vides.

6. Nettoyer les incohérences de session
- Unifier l’usage de `src/components/useSessionGuard.jsx` et supprimer/aligner le doublon `src/components/useSessionGuard.tsx` qui utilise `sessionStorage`.
- Centraliser la déconnexion pour vider les sessions locales et fermer aussi la session backend.

7. Vérification backend ciblée
- Contrôler si le compte admin de production possède bien une ligne `user_roles` avec `role = admin`.
- Si elle manque, prévoir une réparation sûre de ce rôle côté backend, sinon toutes les politiques RLS continueront à renvoyer zéro donnée même si l’interface laisse entrer l’utilisateur.

Validation prévue
- Connexion admin sur le site publié.
- Recharge complète de `/TableauDeBord`.
- Vérification de `Vendeurs`, `Produits`, `SupportAdmin` et `ConfigurationApp`.
- Test sous-admin pour confirmer que les permissions modulaires restent correctes.
- Test session expirée pour vérifier la redirection propre vers `/Connexion` avec message clair.

Détails techniques
- Fichiers principaux : `src/lib/AuthContext.jsx`, `src/pages/Connexion.jsx`, `src/lib/supabaseHelpers.js`, `src/lib/query-client.js`, `src/components/useSousAdminPermissions.jsx`, `src/pages/TableauDeBord.jsx`, `src/pages/Vendeurs.jsx`, `src/pages/Produits.jsx`, `src/pages/Commandes.jsx`, `src/pages/SupportAdmin.jsx`, `src/pages/GestionAdmins.jsx`, `src/pages/ConfigurationApp.jsx`.
- Point clé : le stockage local seul ne donne aucun droit réel ; seules les règles backend basées sur `auth.uid()` + `user_roles` peuvent autoriser la lecture des données admin.
