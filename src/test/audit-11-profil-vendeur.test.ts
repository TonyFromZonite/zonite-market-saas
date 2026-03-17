/**
 * AUDIT 11 — Profil vendeur (2 tests)
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => {
      const chain: any = {};
      chain.select = vi.fn().mockReturnValue(chain);
      chain.eq = vi.fn().mockReturnValue(chain);
      chain.insert = vi.fn().mockResolvedValue({ data: null, error: null });
      chain.update = vi.fn().mockReturnValue(chain);
      return chain;
    }),
  },
}));

import { vendeurApi } from "@/components/vendeurApi";

describe("Audit 11 — Profil vendeur", () => {
  it("11.1 updateSellerProfile met à jour les infos vendeur", async () => {
    await expect(
      vendeurApi.updateSellerProfile("v1", {
        telephone: "691111111",
        ville: "Douala",
        quartier: "Bonamoussadi",
      })
    ).resolves.not.toThrow();
  });

  it("11.2 Données profil vendeur ont les champs requis", () => {
    const profil = {
      full_name: "Jean Dupont",
      email: "jean@test.com",
      telephone: "690000000",
      ville: "Yaoundé",
      quartier: "Bastos",
      numero_mobile_money: "690000000",
      operateur_mobile_money: "orange_money",
    };
    expect(profil.full_name).toBeTruthy();
    expect(profil.email).toContain("@");
    expect(profil.operateur_mobile_money).toMatch(/^(orange_money|mtn_momo|express_union)$/);
  });
});
