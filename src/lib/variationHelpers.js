/**
 * Helpers pour les variations enrichies (image + prix par option).
 *
 * Modèle interne normalisé :
 *   {
 *     id, nom, is_image_variation: bool,
 *     options: [
 *       { value, image_url?, prix_gros?, prix_achat?, prix_vente_conseille? }
 *     ]
 *   }
 *
 * Rétro-compatibilité : les anciennes variations stockées sous la forme
 *   { nom, options: ["Rouge","Bleu"] }
 * sont reconnues et converties à la lecture sans toucher à la base.
 */

export function normalizeOption(opt) {
  if (opt == null) return { value: "" };
  if (typeof opt === "string") return { value: opt };
  if (typeof opt === "object") {
    return {
      value: opt.value ?? opt.nom ?? opt.label ?? "",
      image_url: opt.image_url || opt.image || null,
      prix_gros: opt.prix_gros != null && opt.prix_gros !== "" ? Number(opt.prix_gros) : null,
      prix_achat: opt.prix_achat != null && opt.prix_achat !== "" ? Number(opt.prix_achat) : null,
      prix_vente_conseille:
        opt.prix_vente_conseille != null && opt.prix_vente_conseille !== ""
          ? Number(opt.prix_vente_conseille)
          : null,
    };
  }
  return { value: String(opt) };
}

export function normalizeVariations(variations) {
  if (!Array.isArray(variations)) return [];
  return variations.map((v) => ({
    id: v.id || (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Math.random())),
    nom: v.nom || "",
    is_image_variation: !!v.is_image_variation,
    options: Array.isArray(v.options) ? v.options.map(normalizeOption).filter((o) => o.value) : [],
  }));
}

/** Retourne la variation porteuse d'images (la première qui a is_image_variation=true). */
export function getImageVariation(variations) {
  const norm = normalizeVariations(variations);
  return norm.find((v) => v.is_image_variation) || null;
}

/**
 * Stock total cumulé pour une (varName, value) à travers toutes les agences.
 * Comparaison souple : la `variation_key` stockée peut être "Nom:Val",
 * "Nom1:V1 / Nom2:V2" ou "Nom1:V1|Nom2:V2".
 */
export function getOptionStock(produit, varName, value) {
  if (!produit || !varName || !value) return 0;
  const needle = `${varName}:${value}`;
  let total = 0;
  for (const sc of produit.stocks_par_coursier || []) {
    for (const sv of sc.stock_par_variation || []) {
      const key = sv.variation_key || "";
      // match exact ou comme segment d'une clé composée
      if (
        key === needle ||
        key.split(/\s*\/\s*|\|/).some((seg) => seg.trim() === needle)
      ) {
        total += Number(sv.quantite) || 0;
      }
    }
  }
  return total;
}

export function isOptionAvailable(produit, varName, value) {
  return getOptionStock(produit, varName, value) > 0;
}

/**
 * Renvoie le prix effectif (gros/achat/vente conseillé) pour la sélection
 * courante en privilégiant la variation porteuse d'images si une option
 * porte un override de prix.
 */
export function getEffectivePrices(produit, selectedVariations) {
  const base = {
    prix_gros: Number(produit?.prix_gros) || 0,
    prix_achat: Number(produit?.prix_achat) || 0,
    prix_vente: Number(produit?.prix_vente) || 0,
  };
  if (!produit || !selectedVariations) return base;
  const norm = normalizeVariations(produit.variations);
  for (const v of norm) {
    const sel = selectedVariations[v.nom];
    if (!sel) continue;
    const opt = v.options.find((o) => o.value === sel);
    if (!opt) continue;
    if (opt.prix_gros != null) base.prix_gros = opt.prix_gros;
    if (opt.prix_achat != null) base.prix_achat = opt.prix_achat;
    if (opt.prix_vente_conseille != null) base.prix_vente = opt.prix_vente_conseille;
  }
  return base;
}

/**
 * Renvoie l'URL d'image à afficher pour la sélection courante.
 * - Si la variation porteuse d'images est sélectionnée et que l'option a une image, on l'utilise.
 * - Sinon on retombe sur la 1ère image du produit.
 */
export function getDisplayImage(produit, selectedVariations) {
  const imgVar = getImageVariation(produit?.variations);
  if (imgVar && selectedVariations?.[imgVar.nom]) {
    const opt = imgVar.options.find((o) => o.value === selectedVariations[imgVar.nom]);
    if (opt?.image_url) return opt.image_url;
  }
  return (produit?.images || [])[0] || null;
}
