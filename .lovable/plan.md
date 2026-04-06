

# Clarifier la carte "Total vendeurs" comme métrique globale

## Constat actuel

La carte "Total vendeurs" affiche déjà `vendeurs.length` (tous les vendeurs, sans filtre de période). Mais visuellement, elle est dans le même groupe que Actifs/Inactifs, ce qui peut donner l'impression qu'elle est aussi filtrée par période.

## Modification

**Fichier** : `src/pages/Vendeurs.jsx`

1. Séparer visuellement la carte "Total vendeurs" des cartes Actifs/Inactifs :
   - Afficher la carte **Total vendeurs** en haut, pleine largeur, avec le label "Total vendeurs (global)" pour clarifier qu'elle ne dépend pas de la période
   - En dessous, le sélecteur de période + les 2 cartes Actifs/Inactifs en grille 2 colonnes

2. Le total reste `vendeurs.length` (inchangé), actifs et inactifs restent basés sur la table `ventes` filtrée par période (inchangé)

Résultat visuel :
```text
┌──────────────────────────────────────┐
│  👥 Total vendeurs (global) : 42     │
└──────────────────────────────────────┘
  [1 mois] [6 mois] [1 an] [Global]
┌─────────────────┐ ┌─────────────────┐
│ ✅ Actifs : 12   │ │ ❌ Inactifs : 30 │
└─────────────────┘ └─────────────────┘
```

