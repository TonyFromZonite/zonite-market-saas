Constat : la correction précédente autorise seulement le passage de `statut_kyc` vers `en_attente`, mais la page `/ResoumissionKYC` envoie aussi `seller_status: 'kyc_pending'`. Le trigger backend considère encore `seller_status` comme champ réservé admin, donc il renvoie toujours “Modification non autorisée”.

Plan de correction :
1. Modifier uniquement la fonction backend `prevent_seller_privileged_updates()`.
2. Autoriser, pour le vendeur connecté uniquement, la transition KYC self-service complète :
   - `statut_kyc` vers `en_attente`
   - `seller_status` vers `kyc_pending`
   - depuis les états KYC autorisés : `NULL`, `non_soumis`, `rejete`, `en_attente`
3. Garder bloquées toutes les autres modifications sensibles : rôle, soldes, email vérifié, catalogue, formation, changement d’email/user_id, validation/rejet KYC admin.
4. Ne pas modifier le design, les routes, ni les autres fonctionnalités.
5. Vérifier après migration que la fonction en base contient bien cette exception et que les règles KYC restent protégées.