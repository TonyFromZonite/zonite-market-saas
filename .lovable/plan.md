## Problème

Depuis la migration des notifications admin vers `create_admin_notification()`, quand un vendeur soumet un ticket dans `AideVendeur.jsx` :

1. L'INSERT dans `tickets_support` réussit ✅
2. L'appel `supabase.rpc("create_admin_notification", …)` peut échouer (rate-limit 20/5min, session expirée, validation email, etc.)
3. L'erreur est levée dans le même `try/catch` que la création du ticket → le formulaire **ne se ferme pas**, aucun succès n'est affiché, et le vendeur pense que "le ticket ne part pas" alors qu'il est bien enregistré.

Le même schéma bloquant existe dans les autres pages migrées (`NouvelleVente`, `NouvelleCommandeVendeur`, `DemandePaiement`, `ResoumissionKYC`, `SupportAdmin`) : si la notif admin échoue, l'action principale (vente, commande, paiement, resoumission KYC, réponse support) est perçue comme échouée alors qu'elle a réussi côté DB.

## Correctif

Rendre l'appel `create_admin_notification` **non bloquant** : la notification admin est un effet de bord, elle ne doit jamais faire échouer l'action métier du vendeur.

### Changements

Dans les 6 fichiers migrés au tour précédent, isoler le RPC dans son propre `try/catch` qui logue l'erreur mais ne la propage pas :

```js
try {
  await supabase.rpc("create_admin_notification", { … });
} catch (notifErr) {
  console.warn("Notification admin non envoyée (non bloquant):", notifErr);
}
```

Fichiers touchés :
- `src/pages/AideVendeur.jsx` — soumission ticket
- `src/pages/NouvelleVente.jsx` — création vente
- `src/pages/NouvelleCommandeVendeur.jsx` — création commande
- `src/pages/DemandePaiement.jsx` — demande de paiement
- `src/pages/ResoumissionKYC.jsx` — resoumission KYC
- `src/pages/SupportAdmin.jsx` — réponse admin (garder bloquant ici ? à confirmer, mais côté admin le RPC ne devrait pas rate-limit)

### Détails techniques

- On garde l'appel RPC (les notifs admin restent créées quand tout va bien).
- La bannière de succès + fermeture du formulaire + `invalidateQueries` s'exécutent maintenant systématiquement dès que l'INSERT métier a réussi.
- Aucun changement de schéma ni de policy : les migrations SQL du tour précédent restent valides.
- Aucun impact sur `audit-31` (pas de nouvelle policy INSERT sur `notifications_admin`).

### Vérification

- Relire `AideVendeur.jsx` → le `try` autour de l'insert ticket ne contient plus le RPC.
- Vérifier build/lint OK.
- Test manuel : simuler un rate-limit (ou couper le réseau au moment du RPC) → le ticket doit apparaître dans "Mes Tickets" et le formulaire doit se fermer avec le message de succès.
