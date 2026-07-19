
## Objectif
Mettre à jour le compte du vendeur `josephpodka69@gmail.com` :
- Nouvel email : `josephpodka924@gmail.com`
- Nouveau mot de passe : `Joseph2026@`

## Pourquoi une edge function jetable
Le changement d'email et de mot de passe dans `auth.users` ne peut PAS se faire via une migration SQL (schéma `auth` interdit) ni depuis le client (nécessite `service_role`). Il faut passer par `supabase.auth.admin.updateUserById(...)` depuis une edge function utilisant `SUPABASE_SERVICE_ROLE_KEY`.

## Étapes

1. **Créer une edge function jetable** `admin-update-seller-credentials` (verify_jwt = false, protégée par un secret d'appel one-shot codé en dur dans le body) qui :
   - Récupère le vendeur par `email = 'josephpodka69@gmail.com'` dans `sellers` → obtient `user_id`.
   - Appelle `supabase.auth.admin.updateUserById(user_id, { email: 'josephpodka924@gmail.com', password: 'Joseph2026@', email_confirm: true })`.
   - Met à jour `sellers.email` via service_role (bypass du trigger `prevent_seller_privileged_updates`).
   - Journalise dans `journal_audit` (action `admin_update_seller_credentials`).

2. **Déployer** la fonction, l'**invoquer une fois**, vérifier la réponse.

3. **Vérifier** en base :
   - `SELECT email FROM auth.users WHERE id = <user_id>` → nouvel email.
   - `SELECT email FROM public.sellers WHERE id = <seller_id>` → nouvel email.

4. **Supprimer** l'edge function après succès pour ne laisser aucune porte dérobée.

5. Communiquer au vendeur qu'il doit désormais se connecter avec la nouvelle adresse et le nouveau mot de passe (sa session actuelle sera invalidée par le changement de credentials côté GoTrue).

## Notes sécurité
- La fonction n'est en ligne que le temps d'un appel (créée puis supprimée dans le même flux).
- L'action est tracée dans `journal_audit`.
- Aucun code applicatif permanent n'est ajouté.
