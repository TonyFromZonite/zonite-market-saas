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
  return getOptionStockInCoursiers(produit, varName, value, null);
}

/**
 * Variante filtrée par un Set/Array d'IDs de coursiers.
 * Si `coursierIds` est null/undefined, agrège sur tous les coursiers.
 */
export function getOptionStockInCoursiers(produit, varName, value, coursierIds) {
  if (!produit || !varName || !value) return 0;
  const filterSet =
    coursierIds == null
      ? null
      : coursierIds instanceof Set
      ? coursierIds
      : new Set(coursierIds);
  const needle = `${varName}:${value}`;
  let total = 0;
  for (const sc of produit.stocks_par_coursier || []) {
    if (filterSet && !filterSet.has(sc.coursier_id)) continue;
    for (const sv of sc.stock_par_variation || []) {
      const key = sv.variation_key || "";
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

export function isOptionAvailableInCoursiers(produit, varName, value, coursierIds) {
  return getOptionStockInCoursiers(produit, varName, value, coursierIds) > 0;
}

/**
 * Retourne un Set des IDs de coursiers qui couvrent une ville (et un quartier si fourni).
 * Un coursier couvre la ville si son `ville_id` correspond OU si l'une de ses
 * `zones_livraison_ids` contient un quartier de la ville (via `zones_livraison.quartiers_ids`).
 */
export function getCoursierIdsForVille(coursiers, zonesLivraison, quartiers, villeId, quartierId) {
  const result = new Set();
  if (!villeId) return result;
  const villeQuartierIds = new Set(
    (quartiers || []).filter((q) => q.ville_id === villeId).map((q) => q.id)
  );
  const targetQuartiers = quartierId ? new Set([quartierId]) : villeQuartierIds;

  for (const c of coursiers || []) {
    if (!quartierId && c.ville_id === villeId) {
      result.add(c.id);
      continue;
    }
    const zoneIds = Array.isArray(c.zones_livraison_ids) ? c.zones_livraison_ids : [];
    const covers = zoneIds.some((zid) => {
      const z = (zonesLivraison || []).find((zz) => zz.id === zid);
      if (!z) return false;
      const qids = Array.isArray(z.quartiers_ids) ? z.quartiers_ids : [];
      return qids.some((qid) => targetQuartiers.has(qid));
    });
    if (covers) result.add(c.id);
  }
  return result;
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

/**
 * Galerie d'images fusionnée : images produit puis images des options
 * disponibles de la variation porteuse d'images (dédupliquées).
 * Si `coursierIds` est fourni, ne garde que les options dispo chez ces coursiers.
 */
export function getGalleryImages(produit, coursierIds) {
  const result = [];
  const seen = new Set();
  const push = (url) => {
    if (!url || seen.has(url)) return;
    seen.add(url);
    result.push(url);
  };
  for (const url of produit?.images || []) push(url);
  const imgVar = getImageVariation(produit?.variations);
  if (imgVar) {
    for (const opt of imgVar.options) {
      if (!opt.image_url) continue;
      const available = coursierIds
        ? isOptionAvailableInCoursiers(produit, imgVar.nom, opt.value, coursierIds)
        : isOptionAvailable(produit, imgVar.nom, opt.value);
      if (available) push(opt.image_url);
    }
  }
  return result;
}

/**
 * Trouve la première option de la variation porteuse d'images dont l'URL
 * correspond. Retourne `{ varName, value } | null`.
 */
export function findOptionByImageUrl(produit, url) {
  if (!url) return null;
  const imgVar = getImageVariation(produit?.variations);
  if (!imgVar) return null;
  const opt = imgVar.options.find((o) => o.image_url === url);
  return opt ? { varName: imgVar.nom, value: opt.value } : null;
}

/* ============================================================
 * Helpers de mutation (éditeur admin / stocks_par_coursier)
 * ============================================================ */

/** Recalcule `stock_total` par coursier à partir de `stock_par_variation`. */
export function recomputeCoursierTotals(stocksParCoursier) {
  return (stocksParCoursier || []).map((sc) => ({
    ...sc,
    stock_total: (sc.stock_par_variation || []).reduce(
      (s, sv) => s + (parseInt(sv.quantite, 10) || 0),
      0
    ),
  }));
}

/** Somme totale = stock_global. */
export function computeStockGlobal(stocksParCoursier) {
  return (stocksParCoursier || []).reduce(
    (t, sc) =>
      t +
      (sc.stock_par_variation || []).reduce(
        (s, sv) => s + (parseInt(sv.quantite, 10) || 0),
        0
      ),
    0
  );
}

/** Définit la quantité pour un (coursier, variation_key), crée l'entrée si absente. */
export function setStockForKey(stocksParCoursier, coursierId, variationKey, quantite, coursierMeta) {
  const list = [...(stocksParCoursier || [])];
  let idx = list.findIndex((s) => s.coursier_id === coursierId);
  if (idx === -1) {
    list.push({
      coursier_id: coursierId,
      coursier_nom: coursierMeta?.coursier_nom || "",
      ville: coursierMeta?.ville || "",
      stock_total: 0,
      stock_par_variation: [],
    });
    idx = list.length - 1;
  }
  const sc = { ...list[idx], stock_par_variation: [...(list[idx].stock_par_variation || [])] };
  const vIdx = sc.stock_par_variation.findIndex((v) => v.variation_key === variationKey);
  const q = Math.max(0, parseInt(quantite, 10) || 0);
  if (vIdx === -1) sc.stock_par_variation.push({ variation_key: variationKey, quantite: q });
  else sc.stock_par_variation[vIdx] = { ...sc.stock_par_variation[vIdx], quantite: q };
  list[idx] = sc;
  return recomputeCoursierTotals(list);
}

/** Renomme une option (varName, oldValue -> newValue) dans toutes les `variation_key`. */
export function renameOptionInKeys(stocksParCoursier, varName, oldValue, newValue) {
  if (!varName || !oldValue || !newValue || oldValue === newValue) return stocksParCoursier || [];
  const oldSeg = `${varName}:${oldValue}`;
  const newSeg = `${varName}:${newValue}`;
  return (stocksParCoursier || []).map((sc) => ({
    ...sc,
    stock_par_variation: (sc.stock_par_variation || []).map((sv) => {
      const segs = (sv.variation_key || "").split(/\s*\/\s*|\|/).map((s) => s.trim());
      const updated = segs.map((s) => (s === oldSeg ? newSeg : s));
      return { ...sv, variation_key: updated.join(" / ") };
    }),
  }));
}

