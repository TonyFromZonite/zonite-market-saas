

# Afficher la periode selectionnee dans les labels Actifs/Inactifs

## Modification

**Fichier** : `src/pages/Vendeurs.jsx`

Ajouter le nom de la periode dans le titre des cartes Actifs et Inactifs pour confirmer visuellement le filtre actif.

- "Actifs" → "Actifs (1 mois)" / "Actifs (6 mois)" / "Actifs (1 an)" / "Actifs (global)"
- "Inactifs" → "Inactifs (1 mois)" / etc.

Implementation : creer un map `{ "1m": "1 mois", "6m": "6 mois", "1a": "1 an", "global": "global" }` et concatener au titre des deux cartes.

