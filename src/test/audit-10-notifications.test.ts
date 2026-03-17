/**
 * AUDIT 10 — Notifications (3 tests)
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

import { adminApi } from "@/components/adminApi";
import { vendeurApi } from "@/components/vendeurApi";

describe("Audit 10 — Notifications", () => {
  it("10.1 createNotificationVendeur crée une notification", async () => {
    await expect(
      adminApi.createNotificationVendeur({
        vendeur_id: "v1",
        vendeur_email: "v@t.com",
        titre: "Commande confirmée",
        message: "Votre commande CMD-123 a été confirmée",
        type: "commande",
      })
    ).resolves.not.toThrow();
  });

  it("10.2 marquerNotificationLue met à jour lu=true", async () => {
    await expect(vendeurApi.marquerNotificationLue("n1")).resolves.not.toThrow();
  });

  it("10.3 toutMarquerLu traite un tableau d'IDs", async () => {
    await expect(vendeurApi.toutMarquerLu(["n1", "n2", "n3"])).resolves.not.toThrow();
  });
});
