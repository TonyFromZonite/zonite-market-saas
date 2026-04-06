

# Fix : Wizard de bienvenue qui réapparaît après reconnexion

## Cause racine

Dans `src/components/useSessionGuard.jsx`, la fonction `getVendeurSessionAsync` reconstruit la session vendeur depuis la base de données mais **oublie d'inclure `wizard_completed`** dans l'objet session (lignes 81-92). Quand le vendeur se reconnecte, `session.wizard_completed` est `undefined` (falsy), et le wizard se réaffiche.

De plus, dans `WelcomeWizard.jsx`, l'update DB est dans un `try/catch` vide — si l'écriture échoue silencieusement, la valeur reste `false` en base.

## Corrections

### 1. Ajouter `wizard_completed` à la session reconstruite
**Fichier** : `src/components/useSessionGuard.jsx`
- Ajouter `wizard_completed: seller.wizard_completed || false` dans l'objet session (après `solde_commission`, ligne 92).

### 2. Fiabiliser l'écriture DB dans le wizard
**Fichier** : `src/components/vendor/WelcomeWizard.jsx`
- Vérifier le résultat de l'update et logger l'erreur au lieu du `catch {}` vide.
- Utiliser aussi `seller.user_id` comme fallback pour le filtre si `seller.id` est absent.

| Fichier | Modification |
|---------|-------------|
| `src/components/useSessionGuard.jsx` | Ajouter `wizard_completed` à la session |
| `src/components/vendor/WelcomeWizard.jsx` | Logger les erreurs d'update DB |

