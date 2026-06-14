## Objectif
Permettre à un vendeur de supprimer définitivement son propre compte (RGPD / données personnelles) depuis son espace, avec plusieurs avertissements avant confirmation irréversible. Réutilise la même logique que la suppression admin (Edge Function `delete-seller-complete`).

## Changements

### 1. Edge Function `delete-seller-complete` (autorisation élargie)
Aujourd'hui : seuls les admins peuvent l'appeler.
Modifier l'autorisation pour accepter **aussi** un vendeur qui supprime **son propre compte** :
- Si l'appelant est admin → comportement actuel (peut supprimer n'importe quel `seller_id`).
- Sinon, vérifier que `seller_id` correspond bien à `sellers.user_id = caller.id`. Sinon → 403.
- Ajouter une entrée `journal_audit` avec `action = "auto_suppression_compte"` quand c'est un vendeur.
- Garde-fou : refuser la suppression si l'email du vendeur est celui de l'admin principal (`Tonykodjeu@gmail.com`) — protège l'admin principal (règle mémoire).

Aucune autre logique de cascade n'est modifiée.

### 2. Page `src/pages/ProfilVendeur.jsx` — nouvelle zone "Zone de danger"
Ajouter en bas de la page (sous le bouton Déconnexion existant, ligne 681) une section visuellement séparée :

```
┌─ Zone de danger ────────────────────────────┐
│ Supprimer définitivement mon compte         │
│ [Texte explicatif court RGPD]               │
│ [ Bouton rouge : Supprimer mon compte ]     │
└─────────────────────────────────────────────┘
```

Au clic, ouvrir un **AlertDialog** en 3 étapes successives (état local) pour éviter toute suppression accidentelle :

1. **Étape 1 — Avertissement** : liste claire de ce qui sera supprimé définitivement (profil, produits, commandes, commissions, KYC, notifications, etc.) et que c'est **irréversible**. Boutons : `Annuler` / `Continuer`.
2. **Étape 2 — Solde** : si `solde_commission > 0` ou `solde_en_attente > 0`, afficher un avertissement explicite que tout solde restant sera **perdu**. Boutons : `Annuler` / `J'ai compris, continuer`.
3. **Étape 3 — Confirmation finale** : l'utilisateur doit taper exactement `SUPPRIMER` dans un input avant que le bouton `Supprimer définitivement` (rouge) ne s'active. `Annuler` toujours disponible.

À la confirmation finale :
- Appel `supabase.functions.invoke('delete-seller-complete', { body: { seller_id: vendeur.id } })`.
- Toast succès, `clearAllSessions()`, `supabase.auth.signOut()`, redirection vers `Connexion`.
- En cas d'erreur : toast destructive, dialog reste ouvert.

### 3. Aucune autre modification
- Pas de changement de schéma DB.
- Pas de changement RLS.
- Pas de modification des fichiers admin (`Vendeurs.jsx`) — le flux admin reste identique.
- Pas de modification de mise en page hors de la nouvelle section dans `ProfilVendeur.jsx`.

## Détails techniques
- Fichiers touchés : `supabase/functions/delete-seller-complete/index.ts`, `src/pages/ProfilVendeur.jsx`.
- Composants UI utilisés : `AlertDialog` shadcn déjà présent, `Button` variant destructive, `Input` pour la confirmation textuelle.
- Tests Vitest : aucun test existant ne couvre l'auto-suppression ; les 169 tests doivent rester verts.
