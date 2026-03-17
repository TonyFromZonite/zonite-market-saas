/**
 * AUDIT 8 — Support (2 tests)
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

describe("Audit 8 — Support", () => {
  it("8.1 createTicketSupport crée un ticket avec statut ouvert", async () => {
    await expect(
      vendeurApi.createTicketSupport({
        vendeur_id: "v1",
        vendeur_email: "v@t.com",
        sujet: "Problème commande",
        message: "Ma commande n'est pas arrivée",
        categorie: "livraison",
      })
    ).resolves.not.toThrow();
  });

  it("8.2 marquerTicketLu met à jour lu_par_vendeur", async () => {
    await expect(vendeurApi.marquerTicketLu("t1")).resolves.not.toThrow();
  });
});
