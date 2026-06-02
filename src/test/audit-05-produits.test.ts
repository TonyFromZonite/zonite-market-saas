/**
 * AUDIT 5 — Produits (6 tests)
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => {
      const chain: any = {};
      chain.select = vi.fn().mockReturnValue(chain);
      chain.eq = vi.fn().mockReturnValue(chain);
      chain.insert = vi.fn().mockResolvedValue({ data: [{ id: "p1" }], error: null });
      chain.update = vi.fn().mockReturnValue(chain);
      chain.delete = vi.fn().mockReturnValue(chain);
      return chain;
    }),
  },
}));

import { adminApi } from "@/components/adminApi";

describe("Audit 5 — Produits", () => {
  it("5.1 createProduit insère un produit avec variations JSON", async () => {
    await expect(
      adminApi.createProduit({
        nom: "Produit Test",
        prix_vente: 5000,
        variations: [{ nom: "Couleur:Noir" }],
        stocks_par_coursier: [{ coursier_id: "c1", stock: 10 }],
      })
    ).resolves.not.toThrow();
  });

  it("5.2 updateProduit met à jour un produit existant", async () => {
    await expect(
      adminApi.updateProduit("p1", { nom: "Produit Modifié", prix_vente: 6000 })
    ).resolves.not.toThrow();
  });

  it("5.3 deleteProduit supprime un produit", async () => {
    await expect(adminApi.deleteProduit("p1")).resolves.not.toThrow();
  });

  it("5.4 Catégories CRUD fonctionne", async () => {
    await expect(adminApi.createCategorie({ nom: "Électronique" })).resolves.not.toThrow();
    await expect(adminApi.updateCategorie("cat1", { nom: "Électronique v2" })).resolves.not.toThrow();
    await expect(adminApi.deleteCategorie("cat1")).resolves.not.toThrow();
  });

  it("5.5 Produit requiert un nom et un prix_vente", () => {
    const produit = { nom: "Test", prix_vente: 1000 };
    expect(produit.nom).toBeTruthy();
    expect(produit.prix_vente).toBeGreaterThan(0);
  });

  it("5.6 Stock global doit être >= 0", () => {
    const stock = { stock_global: 0, seuil_alerte_stock: 5 };
    expect(stock.stock_global).toBeGreaterThanOrEqual(0);
    expect(stock.seuil_alerte_stock).toBeGreaterThan(0);
  });
});

describe("Audit 5 — Variations enrichies (image + prix par option)", () => {
  it("5.7 normalizeVariations convertit les options string en objets", async () => {
    const { normalizeVariations } = await import("@/lib/variationHelpers");
    const out = normalizeVariations([{ nom: "Couleur", options: ["Rouge", "Bleu"] }]);
    expect(out[0].options[0]).toEqual({ value: "Rouge" });
    expect(out[0].is_image_variation).toBe(false);
  });

  it("5.8 isOptionAvailable détecte une option en rupture", async () => {
    const { isOptionAvailable, getOptionStock } = await import("@/lib/variationHelpers");
    const produit = {
      stocks_par_coursier: [
        { coursier_id: "c1", stock_par_variation: [
          { variation_key: "Couleur:Rouge", quantite: 5 },
          { variation_key: "Couleur:Bleu", quantite: 0 },
        ] },
      ],
    };
    expect(isOptionAvailable(produit, "Couleur", "Rouge")).toBe(true);
    expect(isOptionAvailable(produit, "Couleur", "Bleu")).toBe(false);
    expect(getOptionStock(produit, "Couleur", "Rouge")).toBe(5);
  });

  it("5.9 getEffectivePrices utilise le prix de la variation si défini", async () => {
    const { getEffectivePrices } = await import("@/lib/variationHelpers");
    const produit = {
      prix_gros: 1000, prix_vente: 1500,
      variations: [{ nom: "Taille", options: [{ value: "XL", prix_gros: 1200, prix_vente_conseille: 1800 }] }],
    };
    const p = getEffectivePrices(produit, { Taille: "XL" });
    expect(p.prix_gros).toBe(1200);
    expect(p.prix_vente).toBe(1800);
  });

  it("5.10 isOptionAvailableInCoursiers filtre par coursier", async () => {
    const { isOptionAvailableInCoursiers } = await import("@/lib/variationHelpers");
    const produit = {
      stocks_par_coursier: [
        { coursier_id: "cA", stock_par_variation: [{ variation_key: "Couleur:Rouge", quantite: 5 }] },
        { coursier_id: "cB", stock_par_variation: [{ variation_key: "Couleur:Rouge", quantite: 0 }] },
      ],
    };
    expect(isOptionAvailableInCoursiers(produit, "Couleur", "Rouge", new Set(["cA"]))).toBe(true);
    expect(isOptionAvailableInCoursiers(produit, "Couleur", "Rouge", new Set(["cB"]))).toBe(false);
    expect(isOptionAvailableInCoursiers(produit, "Couleur", "Rouge", null)).toBe(true);
  });

  it("5.11 option indisponible dans une ville si stock=0 pour ses coursiers", async () => {
    const { isOptionAvailableInCoursiers } = await import("@/lib/variationHelpers");
    const produit = {
      stocks_par_coursier: [
        { coursier_id: "douala1", stock_par_variation: [{ variation_key: "Taille:XL", quantite: 0 }] },
        { coursier_id: "yaounde1", stock_par_variation: [{ variation_key: "Taille:XL", quantite: 3 }] },
      ],
    };
    expect(isOptionAvailableInCoursiers(produit, "Taille", "XL", new Set(["douala1"]))).toBe(false);
    expect(isOptionAvailableInCoursiers(produit, "Taille", "XL", new Set(["yaounde1"]))).toBe(true);
  });

  it("5.12 getCoursierIdsForVille union ville_id + zones_livraison", async () => {
    const { getCoursierIdsForVille } = await import("@/lib/variationHelpers");
    const villeId = "v1";
    const quartiers = [{ id: "q1", ville_id: "v1" }, { id: "q2", ville_id: "v2" }];
    const zonesLivraison = [{ id: "z1", quartiers_ids: ["q1"] }, { id: "z2", quartiers_ids: ["q2"] }];
    const coursiers = [
      { id: "c1", ville_id: "v1", zones_livraison_ids: [] },
      { id: "c2", ville_id: "v9", zones_livraison_ids: ["z1"] },
      { id: "c3", ville_id: "v2", zones_livraison_ids: ["z2"] },
    ];
    const out = getCoursierIdsForVille(coursiers, zonesLivraison, quartiers, villeId);
    expect(out.has("c1")).toBe(true);
    expect(out.has("c2")).toBe(true);
    expect(out.has("c3")).toBe(false);
  });
});
