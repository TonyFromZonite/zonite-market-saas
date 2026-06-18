# Vérification avant publication

Objectif : confirmer que les dernières modifications (affichage unique du badge « KYC : validé » + diagnostic erreur RLS sellers) n'ont rien cassé avant que tu publies.

## Périmètre des derniers changements
1. `src/pages/ProfilVendeur.jsx` — logique d'affichage du badge KYC validé une seule fois.
2. `.lovable/plan.md` — fichier de notes, aucun impact runtime.
3. Aucune modification de schéma DB, d'edge function, ni du flux d'inscription.

## Étapes de vérification

### 1. Audit statique du code modifié
- Relire `ProfilVendeur.jsx` pour confirmer :
  - pas d'import cassé,
  - le flag « KYC vu » est bien lu/écrit (DB ou localStorage selon implémentation),
  - aucune autre section du profil n'a été touchée par effet de bord.

### 2. Suite de tests automatisés
- Lancer la suite Vitest existante (102 tests / 19 domaines).
- Vérifier en particulier les domaines : profil vendeur, KYC, inscription, auth, notifications.
- Tout échec = blocage publication.

### 3. Health check du preview
- `preview_control--get_preview_health` pour vérifier qu'il n'y a ni build error, ni runtime error, ni requêtes 4xx/5xx récentes.

### 4. Vérification visuelle ciblée
- Ouvrir `/ProfilVendeur` sur le compte « Test moi » via `browser--view_preview` pour confirmer :
  - le badge « KYC : validé » ne réapparaît pas,
  - le reste du profil (avatar, infos, liens sociaux, code parrainage) s'affiche normalement.

### 5. Scan de sécurité
- `security--get_scan_results` — pré-requis publication. Si findings critiques → on les traite avant publish.

### 6. Vérification métadonnées SEO/partage
- Contrôler `index.html` : title, meta description, OG, Twitter, favicon — toujours alignés avec ZONITE Market.

## Livrable
Un rapport synthétique :
- ✅ / ❌ pour chacune des 6 étapes,
- liste des éventuels problèmes trouvés,
- recommandation finale : **publier** ou **corriger d'abord**.

Aucune modification de code dans ce plan — uniquement de la lecture, des tests et des vérifications.
