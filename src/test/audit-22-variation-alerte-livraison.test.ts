/**
 * AUDIT 22 — Alerte rouge "variation indisponible" + section Livraison
 *
 * Non-régression de la logique utilisée dans NouvelleCommandeVendeur.jsx :
 *  - `variationsIndispo` se vide automatiquement quand la sélection
 *    devient disponible chez les coursiers couvrant la ville/quartier.
 *  - `stockInCity` (total cumulé pour la nouvelle clé de variation) se
 *    met à jour en conséquence après chaque clic de chip.
 */
import { describe, it, expect } from "vitest";
import {
  normalizeVariations,
  isOptionAvailableInCoursiers,
  getCoursierIdsForVille,
  getEffectivePrices,
  getDisplayImage,
} from "@/lib/variationHelpers";

// --- Référentiel logistique minimal ---
const VILLE_DLA = "ville-dla";
const VILLE_YDE = "ville-yde";
const Q_AKWA = "q-akwa";
const Q_BONA = "q-bona";

const villes = [
  { id: VILLE_DLA, nom: "Douala", actif: true },
  { id: VILLE_YDE, nom: "Yaoundé", actif: true },
];
const quartiers = [
  { id: Q_AKWA, ville_id: VILLE_DLA, nom: "Akwa", actif: true },
  { id: Q_BONA, ville_id: VILLE_DLA, nom: "Bonapriso", actif: true },
];
const coursiers = [
  { id: "cD", ville_id: VILLE_DLA, nom: "Coursier Douala", zones_livraison_ids: [] },
  { id: "cY", ville_id: VILLE_YDE, nom: "Coursier Yaoundé", zones_livraison_ids: [] },
];
const zonesLivraison: any[] = [];

// --- Produit : Couleur (Rouge/Bleu/Vert) ---
// À Douala (cD) : seulement Bleu(5) + Vert(2) en stock — Rouge indispo
// À Yaoundé (cY) : Rouge(4) + Bleu(1) — Vert indispo
const produit = {
  id: "p1",
  nom: "T-shirt",
  variations: [
    {
      id: "v-couleur",
      nom: "Couleur",
      is_image_variation: true,
      options: [
        { value: "Rouge" },
        { value: "Bleu" },
        { value: "Vert" },
      ],
    },
  ],
  stocks_par_coursier: [
    {
      coursier_id: "cD",
      stock_total: 7,
      stock_par_variation: [
        { variation_key: "Couleur:Bleu", quantite: 5 },
        { variation_key: "Couleur:Vert", quantite: 2 },
      ],
    },
    {
      coursier_id: "cY",
      stock_total: 5,
      stock_par_variation: [
        { variation_key: "Couleur:Rouge", quantite: 4 },
        { variation_key: "Couleur:Bleu", quantite: 1 },
      ],
    },
  ],
};

// --- Helpers reproduisant la logique des useMemo du composant ---
function computeVariationsIndispo(
  produit: any,
  selectedVariations: Record<string, string>,
  coursierIds: Set<string> | null
) {
  if (!produit || !coursierIds) return [];
  const variations = normalizeVariations(produit.variations);
  const out: Array<{ varName: string; selected: string; disponibles: string[] }> = [];
  for (const v of variations) {
    const sel = selectedVariations[v.nom];
    if (!sel) continue;
    if (isOptionAvailableInCoursiers(produit, v.nom, sel, coursierIds)) continue;
    const disponibles = v.options
      .map((o) => o.value)
      .filter(
        (val) =>
          val !== sel && isOptionAvailableInCoursiers(produit, v.nom, val, coursierIds)
      );
    out.push({ varName: v.nom, selected: sel, disponibles });
  }
  return out;
}

function computeStockInCityForKey(produit: any, coursierIds: Set<string>, variationKey: string) {
  let total = 0;
  for (const s of produit.stocks_par_coursier || []) {
    if (!coursierIds.has(s.coursier_id)) continue;
    const sv = (s.stock_par_variation || []).find((v: any) => v.variation_key === variationKey);
    total += sv?.quantite || 0;
  }
  return total;
}

describe("Audit 22 — Alerte variation indisponible + Livraison", () => {
  const coursierIdsDouala = getCoursierIdsForVille(
    coursiers,
    zonesLivraison,
    quartiers,
    VILLE_DLA,
    null
  );

  it("22.1 alerte rouge affichée quand la variation choisie est indisponible à Douala", () => {
    const sel = { Couleur: "Rouge" };
    const indispo = computeVariationsIndispo(produit, sel, coursierIdsDouala);
    expect(indispo).toHaveLength(1);
    expect(indispo[0].varName).toBe("Couleur");
    expect(indispo[0].selected).toBe("Rouge");
    expect(indispo[0].disponibles.sort()).toEqual(["Bleu", "Vert"]);
  });

  it("22.2 stockInCity = 0 pour Rouge à Douala", () => {
    const total = computeStockInCityForKey(produit, coursierIdsDouala, "Couleur:Rouge");
    expect(total).toBe(0);
  });

  it("22.3 cliquer la chip Bleu masque l'alerte (variationsIndispo vide)", () => {
    const sel = { Couleur: "Bleu" };
    const indispo = computeVariationsIndispo(produit, sel, coursierIdsDouala);
    expect(indispo).toEqual([]);
  });

  it("22.4 stockInCity se met à jour à 5 après sélection Bleu à Douala", () => {
    const total = computeStockInCityForKey(produit, coursierIdsDouala, "Couleur:Bleu");
    expect(total).toBe(5);
  });

  it("22.5 cliquer Vert masque aussi l'alerte et stockInCity = 2", () => {
    const sel = { Couleur: "Vert" };
    expect(computeVariationsIndispo(produit, sel, coursierIdsDouala)).toEqual([]);
    expect(computeStockInCityForKey(produit, coursierIdsDouala, "Couleur:Vert")).toBe(2);
  });

  it("22.6 changer de ville (Yaoundé) recalcule : Rouge devient dispo, Vert indispo", () => {
    const coursierIdsYde = getCoursierIdsForVille(
      coursiers,
      zonesLivraison,
      quartiers,
      VILLE_YDE,
      null
    );
    expect(computeVariationsIndispo(produit, { Couleur: "Rouge" }, coursierIdsYde)).toEqual([]);
    const indispoVert = computeVariationsIndispo(produit, { Couleur: "Vert" }, coursierIdsYde);
    expect(indispoVert).toHaveLength(1);
    expect(indispoVert[0].disponibles.sort()).toEqual(["Bleu", "Rouge"]);
  });

  it("22.7 quand aucune option n'est dispo, disponibles = [] (message 'aucune autre')", () => {
    const produitVide = {
      ...produit,
      stocks_par_coursier: [
        {
          coursier_id: "cD",
          stock_total: 0,
          stock_par_variation: [],
        },
      ],
    };
    const indispo = computeVariationsIndispo(
      produitVide,
      { Couleur: "Rouge" },
      coursierIdsDouala
    );
    expect(indispo).toHaveLength(1);
    expect(indispo[0].disponibles).toEqual([]);
  });

  describe("22.b — effectivePrices & displayImage recalculés à chaque clic de chip", () => {
    const produitPrix = {
      id: "p2",
      nom: "T-shirt premium",
      prix_gros: 5000,
      prix_achat: 3000,
      prix_vente: 8000,
      images: ["https://img/base.jpg"],
      variations: [
        {
          id: "v-couleur",
          nom: "Couleur",
          is_image_variation: true,
          options: [
            { value: "Rouge", image_url: "https://img/rouge.jpg", prix_gros: 5500, prix_vente_conseille: 8500 },
            { value: "Bleu", image_url: "https://img/bleu.jpg", prix_gros: 6000, prix_vente_conseille: 9000 },
            { value: "Vert", image_url: "https://img/vert.jpg" },
          ],
        },
      ],
      stocks_par_coursier: [],
    };

    it("22.8 base : pas de sélection → prix produit + image principale", () => {
      const p = getEffectivePrices(produitPrix, {});
      expect(p.prix_gros).toBe(5000);
      expect(p.prix_vente).toBe(8000);
      expect(getDisplayImage(produitPrix, {})).toBe("https://img/base.jpg");
    });

    it("22.9 clic chip Rouge → prix override Rouge + image Rouge", () => {
      const sel = { Couleur: "Rouge" };
      const p = getEffectivePrices(produitPrix, sel);
      expect(p.prix_gros).toBe(5500);
      expect(p.prix_vente).toBe(8500);
      expect(getDisplayImage(produitPrix, sel)).toBe("https://img/rouge.jpg");
    });

    it("22.10 clic chip Bleu recalcule prix + image (différents de Rouge)", () => {
      const sel = { Couleur: "Bleu" };
      const p = getEffectivePrices(produitPrix, sel);
      expect(p.prix_gros).toBe(6000);
      expect(p.prix_vente).toBe(9000);
      expect(getDisplayImage(produitPrix, sel)).toBe("https://img/bleu.jpg");
    });

    it("22.11 clic chip Vert (sans override prix) → fallback prix produit, image Vert", () => {
      const sel = { Couleur: "Vert" };
      const p = getEffectivePrices(produitPrix, sel);
      expect(p.prix_gros).toBe(5000); // fallback car pas d'override
      expect(p.prix_vente).toBe(8000);
      expect(getDisplayImage(produitPrix, sel)).toBe("https://img/vert.jpg");
    });

    it("22.12 séquence Rouge → Bleu → Vert : chaque sélection donne un résultat distinct", () => {
      const seq = ["Rouge", "Bleu", "Vert"].map((val) => {
        const sel = { Couleur: val };
        return {
          val,
          prix: getEffectivePrices(produitPrix, sel),
          img: getDisplayImage(produitPrix, sel),
        };
      });
      expect(seq[0].img).not.toBe(seq[1].img);
      expect(seq[1].img).not.toBe(seq[2].img);
      expect(seq[0].prix.prix_gros).not.toBe(seq[1].prix.prix_gros);
    });
  });
});

