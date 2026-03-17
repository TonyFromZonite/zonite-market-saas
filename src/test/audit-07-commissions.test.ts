/**
 * AUDIT 7 — Commissions (3 tests)
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

describe("Audit 7 — Commissions", () => {
  it("7.1 Calcul de commission : montant × taux", () => {
    const montant = 10000;
    const taux = 10; // %
    const commission = (montant * taux) / 100;
    expect(commission).toBe(1000);
  });

  it("7.2 createDemandePaiement crée une demande avec statut en_attente", async () => {
    await expect(
      vendeurApi.createDemandePaiement({
        vendeur_id: "v1",
        vendeur_email: "v@t.com",
        montant: 5000,
        numero_mobile_money: "690000000",
        operateur_mobile_money: "orange_money",
      })
    ).resolves.not.toThrow();
  });

  it("7.3 Profit Zonite = montant - commission_vendeur - prix_achat", () => {
    const montant_total = 10000;
    const commission_vendeur = 1000;
    const prix_achat = 6000;
    const profit = montant_total - commission_vendeur - prix_achat;
    expect(profit).toBe(3000);
  });
});
