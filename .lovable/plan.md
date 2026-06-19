## Plan de correction ciblée

1. **Sécuriser la validation du code email**
   - Dans `InscriptionVendeur.jsx`, vérifier explicitement le résultat de `update()` sur `sellers`.
   - Si la mise à jour échoue, afficher une erreur claire au vendeur au lieu de créer une session locale incomplète.
   - Recharger la ligne vendeur après mise à jour pour confirmer que `email_verified=true` et `seller_status='active_seller'` sont bien persistés.

2. **Créer une session vendeur complète avant redirection**
   - Inclure `user_id`, `full_name/nom_complet`, `statut_kyc`, `catalogue_debloque`, `training_completed`, `wizard_completed` depuis la base.
   - Conserver la purge des anciens drapeaux biométriques pour éviter le verrou d’un ancien utilisateur.

3. **Éviter le renvoi parasite vers l’inscription**
   - Après validation OTP réussie, déclencher l’évènement de revalidation d’accès déjà prévu par `EmailVerifiedRouteGuard`.
   - Utiliser une navigation React vers `/EspaceVendeur` avec fallback `window.location.href` seulement si nécessaire.

4. **Renforcer les tests existants**
   - Ajouter/adapter un test pour vérifier que si `update()` échoue, aucun faux accès vendeur n’est créé.
   - Ajouter/adapter un test du flux réussi pour confirmer que la session contient `user_id` et que l’accès `/EspaceVendeur` n’est pas renvoyé vers `InscriptionVendeur`.

5. **Validation**
   - Lancer les tests ciblés liés à l’inscription vendeur et à l’accès vendeur.
   - Ne modifier aucun layout ni autre fonctionnalité.