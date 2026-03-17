

## Plan: Login par username + Logo ZONITE partout

### Analyse

**Login actuel**: La page Connexion.jsx n'accepte que l'email. L'admin (tonykodjeu@gmail.com) et les sous-admins doivent pouvoir se connecter avec email OU username.

**Logo actuel**: La page Connexion.jsx utilise `/lovable-uploads/87d7eb1b-437e-4a6a-b26e-387a91498d34.png` (l'image ZONITE uploadée). Les autres composants (AdminSidebar, AdminHeader, EspaceVendeur, etc.) utilisent `LOGO_URL` de constants.jsx qui pointe vers `/favicon.ico`. Il faut uniformiser vers l'image ZONITE uploadée partout.

**Base de données**: Les tables `sellers` et `sous_admins` n'ont pas de colonne `username`. Il faut l'ajouter.

---

### Changements

#### 1. Migration DB : ajouter `username` aux tables
- Ajouter colonne `username` (text, nullable, unique) à `sellers`
- Ajouter colonne `username` (text, nullable, unique) à `sous_admins`
- Insérer/mettre à jour le username "admin" pour le seller avec email `tonykodjeu@gmail.com`

#### 2. Mettre à jour `constants.jsx`
- Changer `LOGO_URL` de `/favicon.ico` vers `/lovable-uploads/87d7eb1b-437e-4a6a-b26e-387a91498d34.png`

#### 3. Mettre à jour `Connexion.jsx` - Login par username ou email
- Changer le label du champ de "Email" à "Email ou nom d'utilisateur"
- Changer le type de l'input de `email` à `text`
- Dans `handleLogin`: si la saisie ne contient pas `@`, chercher le username dans `sellers` (mode admin) ou `sous_admins` pour résoudre l'email correspondant, puis appeler `signInWithPassword` avec l'email trouvé
- Mettre à jour le logo pour utiliser la constante `LOGO` au lieu du chemin hardcodé

#### 4. Logo cohérent sur Connexion.jsx
- Remplacer `src="/lovable-uploads/..."` par `src={LOGO}` (ligne 153) pour utiliser la constante centralisée

