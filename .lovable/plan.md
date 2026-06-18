## Vérification : affichage « KYC : Validé » sur le profil vendeur

J'ai relu `src/pages/ProfilVendeur.jsx` (lignes 597-627), la section « Statut du compte ».

### Comportement actuel (déjà conforme à la demande)

La ligne KYC du bloc « Statut du compte » est construite ainsi :

```jsx
...(compteVendeur?.statut_kyc === "valide"
  ? []                                  // → aucune ligne KYC
  : [{ label: "KYC",
       val: statut_kyc === "rejete" ? "✗ Rejeté" : "En attente",
       ok: false }])
```

Donc :
- `statut_kyc = en_attente` → ligne « KYC — En attente » (jaune)
- `statut_kyc = rejete` → ligne « KYC — ✗ Rejeté » (rouge) + motif
- `statut_kyc = valide` → **aucune ligne KYC affichée**, définitivement

La confirmation reste visible côté vendeur uniquement via la notification « KYC Validé ! » envoyée par `GestionKYC.jsx` au moment de la validation.

### Pourquoi vous voyez peut-être encore « KYC : Validé » sur le compte « Test moi »

Trois causes possibles, aucune liée au code du profil :

1. **Bundle en cache** sur l'appareil : l'ancienne version du `ProfilVendeur.jsx` est toujours servie. Forcer un rechargement (vider le cache PWA / pull-to-refresh / fermer-rouvrir l'app) résout l'affichage.
2. **Confusion avec un autre bloc** : la barre « Progression du profil » (`ProfileProgress.jsx`) liste bien une étape « KYC validé ✅ » — c'est une checklist de complétion, pas le statut KYC, et c'est voulu.
3. **`statut_kyc` du compte Test moi ≠ `"valide"`** en base (ex : `"en_attente"`) — dans ce cas la ligne doit bien s'afficher.

### Plan proposé

Aucune modification de code n'est nécessaire : le comportement demandé est déjà implémenté correctement.

Action proposée si vous validez :
1. Vérifier en base la valeur exacte de `sellers.statut_kyc` pour le compte « Test moi » (via une requête lecture seule sur Lovable Cloud).
2. Si la valeur est bien `"valide"` mais l'UI montre encore la ligne → c'est un cache navigateur/PWA ; je documenterai la procédure de purge.
3. Si vous me confirmez que c'est en fait la ligne « KYC validé » de la **barre de progression** qui vous gêne, je peux la masquer une fois atteinte (à confirmer, car cela casse la jauge de complétion à 100 %).

Dites-moi laquelle de ces pistes vous voulez que je creuse.