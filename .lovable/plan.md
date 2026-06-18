
# Diagnostic — erreur RLS sur `sellers` au moment du « Créer mon compte »

## Constat technique

1. La page `src/pages/InscriptionVendeur.jsx` (lignes 168-177) appelle UNIQUEMENT l'Edge Function `register-seller` pour créer le compte. Cette fonction utilise la clé `SUPABASE_SERVICE_ROLE_KEY` côté serveur, ce qui **contourne complètement la RLS**. Elle ne peut donc PAS produire une erreur « new row violates row-level security policy ».
2. Les politiques actuelles sur `public.sellers` (vérifiées en base) :
   - `INSERT` : `authenticated`, `WITH CHECK (auth.uid() = user_id)`
   - `SELECT/UPDATE` propriétaire + admin.
   Aucune politique anonyme. Seule une tentative d'INSERT client-side (sans Edge Function) déclencherait ce message.
3. Recherche dans tout le code source : aucun `supabase.from("sellers").insert(...)` n'existe côté client. Tous les inserts passent par l'Edge Function.
4. Logs Auth récents : les vraies inscriptions (11:13, 11:17…) sont passées **avec succès** via `/admin/users` (= service_role appelé par l'edge function `register-seller`). Aucun rejet RLS dans les logs serveur.

## Conclusion

L'erreur que voit le vendeur provient quasi-certainement d'un **bundle JavaScript obsolète** servi par le cache navigateur / service-worker PWA sur `zonite.org`. Cette ancienne version exécute encore un `supabase.from("sellers").insert(...)` direct depuis le navigateur, ce qui est aujourd'hui bloqué par la politique INSERT (`auth.uid() = user_id`) puisque le vendeur n'est pas encore connecté à ce moment-là.

## Plan d'action

### Étape 1 — Confirmer la cause (sans toucher au code)
Demander au vendeur :
- Capture d'écran de l'erreur (texte exact + URL).
- Faire un **rechargement forcé** : `Ctrl+Shift+R` (Chrome desktop) / fermer-rouvrir l'onglet (Safari iOS) / désinstaller-réinstaller la PWA si applicable.
- Réessayer l'inscription. Si l'erreur disparaît → cache confirmé.

### Étape 2 — Vérifier côté serveur en parallèle
- Consulter `supabase auth logs` au moment précis du test : si on voit un `POST /admin/users` 200 ou 422, c'est bien l'Edge Function. Si on voit un `POST /rest/v1/sellers` 401/403, c'est confirmé : ancien bundle.
- Vérifier que `register-seller` est bien déployée et active (déjà confirmé dans les logs : booted OK).

### Étape 3 — Renforcer le service worker (si cache confirmé)
Forcer l'invalidation du cache pour tous les vendeurs :
- Bumper la version du service worker pour déclencher un `skipWaiting()` + `clients.claim()` automatique au prochain chargement.
- Aucune modification du flux d'inscription nécessaire (il est déjà correct).

### Étape 4 — Filet de sécurité (optionnel)
Si l'on souhaite que MÊME un vieux bundle ne casse pas, on peut intercepter les erreurs d'inscription dans `InscriptionVendeur.jsx` et afficher un message clair invitant à recharger la page. Aucun changement de RLS n'est souhaitable : la politique actuelle est correcte du point de vue sécurité.

## À NE PAS faire

- Ne pas assouplir la politique INSERT sur `sellers` (ouvrirait une faille : n'importe qui pourrait créer des vendeurs).
- Ne pas dupliquer la logique d'inscription côté client.

## Question ouverte

Souhaitez-vous que je passe en mode build pour :
- **(A)** seulement bumper la version du service worker afin de forcer la mise à jour du cache chez tous les utilisateurs, **ou**
- **(B)** également ajouter un message d'erreur explicite (« Rechargez la page ») si l'ancien chemin client est déclenché, **ou**
- **(C)** simplement attendre la capture d'écran du vendeur avant toute action ?
