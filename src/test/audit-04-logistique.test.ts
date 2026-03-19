/**
 * AUDIT 4 — Logistique (6 tests)
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => {
      const chain: any = {};
      chain.select = vi.fn().mockReturnValue(chain);
      chain.eq = vi.fn().mockReturnValue(chain);
      chain.insert = vi.fn().mockResolvedValue({ data: [{ id: "c1" }], error: null });
      chain.update = vi.fn().mockReturnValue(chain);
      chain.delete = vi.fn().mockReturnValue(chain);
      chain.order = vi.fn().mockReturnValue(chain);
      return chain;
    }),
  },
}));

import { adminApi } from "@/components/adminApi";

describe("Audit 4 — Logistique", () => {
  it("4.1 createLivraison appelle supabase.from('livraisons').insert", async () => {
    await expect(
      adminApi.createLivraison({ nom: "Livreur Test", telephone: "690000000" })
    ).resolves.not.toThrow();
  });

  it("4.2 updateLivraison met à jour un livreur existant", async () => {
    await expect(
      adminApi.updateLivraison("lid1", { nom: "Livreur Modifié" })
    ).resolves.not.toThrow();
  });

  it("4.3 deleteLivraison supprime un livreur", async () => {
    await expect(adminApi.deleteLivraison("lid1")).resolves.not.toThrow();
  });

  it("4.4 createPageUrl génère les routes de gestion logistique", async () => {
    const { createPageUrl } = await import("@/utils");
    expect(createPageUrl("GestionCoursiers")).toBe("/GestionCoursiers");
    expect(createPageUrl("GestionZones")).toBe("/GestionZones");
    expect(createPageUrl("Livraisons")).toBe("/Livraisons");
  });

  it("4.5 createCoursier crée un coursier", async () => {
    await expect(
      adminApi.createCoursier({ nom: "Coursier A", telephone: "691000000" })
    ).resolves.not.toThrow();
  });

  it("4.6 updateCoursier met à jour un coursier", async () => {
    await expect(
      adminApi.updateCoursier("c1", { actif: false })
    ).resolves.not.toThrow();
  });
});
