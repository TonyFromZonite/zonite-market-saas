## Cause du bug

Après la saisie du code email dans `InscriptionVendeur.validerCode` (ligne 249-321), le flux fait :
1. `localStorage.setItem("vendeur_session", ...)` pour le nouveau vendeur
2. `window.location.href = "/EspaceVendeur"` → rechargement complet

Au remount, `src/App.jsx` (lignes 130-138) exécute :
```js
const bioEnabled = localStorage.getItem("bio_enabled") === "true"
                || localStorage.getItem("zonite_bio_enrolled") === "1";
if ((adminSession || vendorSession) && bioEnabled) setLocked(true);
```

**Problème** : si un autre utilisateur s'était déjà inscrit/connecté sur le même navigateur (téléphone partagé, démo, etc.), les clés `bio_enabled`, `zonite_bio_enrolled`, `zonite_bio_cred_id` restent dans localStorage. Le `logout()` dans `AuthContext.jsx` ne les nettoie pas non plus.

Conséquence pour le nouveau vendeur :
- `AppLockScreen` s'affiche immédiatement
- Le prompt biométrique WebAuthn (avec `allowCredentials: []`) déclenche l'authentificateur de la plateforme, mais aucun credential n'est lié à ce nouveau compte → échec
- Le fallback password essaie `signInWithPassword` qui peut renvoyer vers `/Connexion`, ce que l'utilisateur perçoit comme "renvoi à la page d'inscription"

Depuis hier, ce scénario touche tous les clients qui s'inscrivent sur un appareil ayant déjà servi à un autre vendeur.

## Correctif (minimal, ciblé)

**Fichier : `src/pages/InscriptionVendeur.jsx`** — dans `validerCode`, juste avant `localStorage.setItem("vendeur_session", ...)` (ligne 304), purger les drapeaux biométriques résiduels :

```js
// Évite qu'un drapeau biométrique laissé par un autre utilisateur
// sur ce navigateur ne verrouille le nouveau vendeur fraîchement inscrit.
localStorage.removeItem("bio_enabled");
localStorage.removeItem("zonite_bio_enrolled");
localStorage.removeItem("zonite_bio_cred_id");
localStorage.removeItem("zonite_bio_prompt_dismissed");
```

C'est tout. Rien d'autre n'est modifié :
- Le flux d'inscription, le code OTP, l'envoi d'email, le parrainage, l'auto sign-in restent identiques.
- `AppLockScreen` et la biométrie continuent de fonctionner normalement pour les utilisateurs déjà inscrits qui ont activé leur empreinte.
- À sa prochaine connexion, le nouveau vendeur pourra réactiver la biométrie sur son propre compte via le flux habituel (`BiometricLock` propose l'enrôlement).

## Validation après correctif

1. `bunx vitest run` (les 187 tests existants doivent rester verts — aucun ne dépend de ces clés au moment de l'inscription).
2. Smoke manuel : s'inscrire avec un nouveau compte sur un navigateur où `bio_enabled` est déjà à `"true"` → après validation du code email, atterrissage direct sur `/EspaceVendeur` sans écran de verrouillage.
