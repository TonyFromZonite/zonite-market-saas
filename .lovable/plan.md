## Problème

Depuis la dernière mise à jour, l'app affiche un écran blanc. Les requêtes réseau du client le confirment :

```
TypeError: installGlobalCriticalHandlers(...) is not a function
  at src/main.jsx:9
```

`main.jsx` plante à la ligne 9 → React n'est jamais monté → page blanche. Comme l'erreur survient avant le rendu, un simple "rafraîchir" ne suffit pas tant que le bundle servi (HTTP cache, ancien onglet ouvert, cache CDN) reste celui qui ne connaît pas la nouvelle export.

La fonction `installGlobalCriticalHandlers` existe bien dans `src/lib/criticalLogger.js`, donc le code source est correct. Le crash vient d'un décalage : un client charge un ancien `criticalLogger.js` mis en cache qui n'exporte pas encore ce symbole, combiné à un nouveau `main.jsx` qui l'appelle sans garde.

## Correctif

### `src/main.jsx`
Rendre l'appel défensif pour qu'un module mis en cache (ou tout autre échec d'import futur) ne bloque jamais le rendu de l'app :

- Remplacer `installGlobalCriticalHandlers()` par un appel protégé :
  - vérifier `typeof installGlobalCriticalHandlers === "function"` avant d'appeler,
  - envelopper dans un `try/catch` qui se contente d'un `console.warn`.
- Aucun changement de comportement quand le module est à jour : les handlers globaux s'installent normalement.

Aucune autre modification (pas de changement métier, pas de backend, pas de schéma DB). 169 tests doivent rester verts.

## Pourquoi ça résout l'incident

- Les clients qui chargent l'ancienne version cachée n'affichent plus d'écran blanc : ils perdent juste temporairement les handlers globaux d'erreur, jusqu'au prochain hard refresh qui récupère le bundle à jour.
- Les nouveaux clients reçoivent les deux fichiers à jour et fonctionnent comme avant.
- C'est une protection durable : toute future désynchronisation entre `main.jsx` et `criticalLogger.js` ne pourra plus tuer l'application.
