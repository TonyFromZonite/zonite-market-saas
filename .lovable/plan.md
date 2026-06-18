## Diagnostic
Sur l'inscription vendeur, le front-end appelle l'edge function `register-seller`. Mon test direct (curl) répond **200 OK** et la fonction `send-verification-email` envoie bien le code → côté serveur, le flux fonctionne.

L'erreur que voit le vendeur — `Edge Function returned a non-2xx status code` — est le **message générique** de `@supabase/supabase-js` lorsque :
- le serveur renvoie un statut non-2xx (ex : 409 doublon email/username, 429 throttle Auth, 502 si l'email Resend est temporairement indisponible) ;
- **et que** l'extraction du JSON via `error.context?.json?.()` échoue (body déjà consommé, réseau, etc.) → on retombe sur `error.message` qui est cette phrase brute.

Autrement dit le serveur renvoie probablement un vrai message (« Cet email a déjà un compte », « Patientez 60s », etc.), mais l'UI ne sait pas l'afficher dans certains cas et montre la phrase technique.

## Changement (UI seulement, pas de logique métier)
Améliorer la robustesse de l'extraction du message d'erreur côté front, sans toucher à l'edge function ni au flux d'inscription.

### Fichier : `src/pages/InscriptionVendeur.jsx`
1. Dans `handleRegister`, remplacer le bloc qui lit `error.context?.json?.()` par un util `extractFunctionError(error)` qui :
   - tente `await error.context.clone().json()` ;
   - fallback `await error.context.clone().text()` puis `JSON.parse` ;
   - si rien d'exploitable, retourne `{ message: "Une erreur est survenue lors de l'inscription. Réessayez dans un instant.", status }` (texte clair, jamais « non-2xx ») ;
   - ajoute un `console.error("[register-seller]", status, raw)` pour faciliter le debug futur.
2. Utiliser ce même util pour l'appel à `resend-verification-code` (ligne 323) afin d'avoir un comportement cohérent.
3. Conserver intégralement la logique existante : throttle (`retry_after`), `field` mapping, `payload.error` priorisé.

### Aucune autre modification
- L'edge function `register-seller` reste telle quelle (testée et OK).
- Pas de changement de schéma, de RLS, ni de flux email.
- Pas de modification visuelle hors message d'erreur.

## Vérification
1. Re-tester un cas nominal d'inscription : doit toujours fonctionner.
2. Re-tester avec un email déjà utilisé : doit afficher « Cet email a déjà un compte. Connectez-vous. » au lieu du message générique.
3. Re-tester deux inscriptions rapides successives (throttle) : doit afficher le message de patientez X secondes.