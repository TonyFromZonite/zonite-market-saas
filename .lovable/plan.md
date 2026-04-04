

# Correction : KYC vide affiché à l'admin dès l'inscription

## Problème

La colonne `statut_kyc` dans la table `sellers` a une valeur par défaut `'en_attente'`. Quand un vendeur s'inscrit (`InscriptionVendeur.jsx`), aucune valeur `statut_kyc` n'est spécifiée dans l'insert, donc le nouveau vendeur apparaît immédiatement comme "KYC en attente" dans les pages admin — alors qu'il n'a rien soumis.

## Solution

### 1. Migration : changer la valeur par défaut de `statut_kyc`

```sql
ALTER TABLE public.sellers 
  ALTER COLUMN statut_kyc SET DEFAULT 'non_soumis';

-- Corriger les vendeurs existants qui ont statut_kyc = 'en_attente' 
-- mais n'ont jamais soumis de documents KYC
UPDATE public.sellers 
SET statut_kyc = 'non_soumis' 
WHERE statut_kyc = 'en_attente' 
  AND kyc_document_recto_url IS NULL 
  AND kyc_selfie_url IS NULL 
  AND kyc_passeport_url IS NULL;
```

### 2. `InscriptionVendeur.jsx` — expliciter `statut_kyc: 'non_soumis'` dans l'insert

Ajouter `statut_kyc: 'non_soumis'` à l'objet inséré ligne 178, pour ne pas dépendre du défaut.

### 3. Filtres admin — exclure `non_soumis` des dossiers "en attente"

Les pages suivantes filtrent sur `statut_kyc === "en_attente"` pour afficher les dossiers à valider. Aucun changement nécessaire car `non_soumis` ≠ `en_attente`, ils n'apparaîtront plus.

Pages concernées (aucune modification requise) :
- `GestionKYC.jsx` — filtre `en_attente` ✓
- `Layout.jsx` — badge count filtre `en_attente` ✓
- `TableauDeBord.jsx` — dashboard filtre `en_attente` ✓

### 4. Ajouter `non_soumis` au dictionnaire `STATUTS_KYC` dans `GestionKYC.jsx`

Pour que les vendeurs avec `statut_kyc = 'non_soumis'` dans la liste "traités" affichent un label lisible au lieu de `undefined`.

```js
non_soumis: { label: "Non soumis", couleur: "bg-slate-100 text-slate-600" },
```

### 5. `SellerStatusEngine.jsx` — aucun changement

Le statut `kyc_required` côté `seller_status` est distinct de `statut_kyc`. Pas d'impact.

## Fichiers modifiés

| Fichier | Action |
|---------|--------|
| Migration SQL | Changer défaut `statut_kyc` + corriger données existantes |
| `src/pages/InscriptionVendeur.jsx` | Ajouter `statut_kyc: 'non_soumis'` à l'insert |
| `src/pages/GestionKYC.jsx` | Ajouter entrée `non_soumis` dans `STATUTS_KYC` |

