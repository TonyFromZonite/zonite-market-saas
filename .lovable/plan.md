## Problème

Les images `.HEIC` (format Apple iPhone) ne sont pas supportées nativement par les navigateurs Chrome/Firefox/Edge → l'image uploadée s'affiche cassée. De plus, les très grandes images (5–10 Mo) ralentissent le catalogue et consomment beaucoup de bande passante.

## Solution

Ajouter une **normalisation côté client** au moment de l'upload, avant l'envoi à Supabase Storage. Le fichier original n'est jamais stocké tel quel — il est converti en JPEG web-friendly.

### Étapes du pipeline (transparent pour le vendeur/admin)

1. **Détection HEIC/HEIF** par extension (`.heic`, `.heif`) ou MIME type.
2. **Conversion HEIC → JPEG** via la librairie `heic2any` (purement navigateur, ~50 Ko, pas de backend).
3. **Redimensionnement** : si largeur > 1600 px, redimensionner à 1600 px max (ratio préservé) via `<canvas>`.
4. **Compression JPEG** qualité 0.85 (équilibre taille/qualité).
5. **Renommage** : `produit_{timestamp}.jpg` au lieu de `IMG_5613.HEIC`.
6. Le fichier final (typiquement < 400 Ko) est envoyé via `uploadFile()` existant.

### Fichiers à modifier

- **`src/lib/imageProcessor.js`** (nouveau) — fonction `processImageForUpload(file)` qui retourne un `File` normalisé. Encapsule HEIC + resize + compression.
- **`src/lib/supabaseHelpers.js`** — `uploadFile()` appelle `processImageForUpload()` avant l'upload Storage. Centralisé ici → bénéficie automatiquement à :
  - `DialogProduit.jsx` (images produit + variations)
  - `ProfilVendeur.jsx` (photo profil)
  - tout autre appel existant
- **`package.json`** — ajout de `heic2any` (~50 Ko gzip).

### Garde-fous

- Si la conversion HEIC échoue (fichier corrompu), message clair : « Format non supporté, exportez en JPEG depuis votre iPhone (Réglages → Appareil photo → Formats → Plus compatible) ».
- Indicateur de progression « Conversion… » dans le bouton upload pendant le traitement (peut prendre 2–4 s sur gros HEIC).
- KYC documents (autre bucket) : non touchés — la conversion s'applique uniquement aux images produits/profil.

### Hors scope

- Pas de changement RLS, pas de changement Storage, pas de modification du proxy `serve-product-image`.
- Pas de re-traitement des images déjà uploadées (anciennes HEIC cassées restent telles quelles ; il faudra les ré-uploader).

## Détails techniques

```js
// src/lib/imageProcessor.js
import heic2any from "heic2any";

const MAX_WIDTH = 1600;
const JPEG_QUALITY = 0.85;

export async function processImageForUpload(file) {
  let working = file;
  const isHeic = /\.(heic|heif)$/i.test(file.name) 
              || file.type === "image/heic" || file.type === "image/heif";

  if (isHeic) {
    const blob = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 });
    working = new File([blob], file.name.replace(/\.(heic|heif)$/i, ".jpg"), { type: "image/jpeg" });
  }

  // Resize via canvas si > MAX_WIDTH
  const resized = await resizeIfNeeded(working);
  return resized;
}
```

Test manuel après implémentation : uploader un `.HEIC` iPhone de 8 Mo → doit s'afficher dans la grille produit, taille finale ~200–400 Ko.
