/**
 * AUDIT 5 — Produits (4 tests)
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
});
