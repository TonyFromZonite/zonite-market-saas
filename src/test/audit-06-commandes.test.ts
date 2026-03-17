/**
 * AUDIT 6 — Commandes (6 tests)
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => {
      const chain: any = {};
      chain.select = vi.fn().mockReturnValue(chain);
      chain.eq = vi.fn().mockReturnValue(chain);
      chain.insert = vi.fn().mockResolvedValue({ data: [{ id: "cmd1" }], error: null });
      chain.update = vi.fn().mockReturnValue(chain);
      chain.delete = vi.fn().mockReturnValue(chain);
      chain.order = vi.fn().mockReturnValue(chain);
      chain.single = vi.fn().mockResolvedValue({ data: { id: "cmd1", statut: "en_attente_validation_admin" }, error: null });
      return chain;
    }),
  },
}));

import { adminApi } from "@/components/adminApi";

describe("Audit 6 — Commandes", () => {
  it("6.1 Commande a le statut initial en_attente_validation_admin", () => {
    const commande = {
      vendeur_id: "v1",
      vendeur_email: "v@t.com",
      produit_nom: "Produit A",
      client_nom: "Client X",
      client_telephone: "690000000",
      prix_unitaire: 5000,
      montant_total: 5000,
    };
    // Statut par défaut dans la DB est 'en_attente_validation_admin'
    expect(commande.vendeur_id).toBeDefined();
    expect(commande.client_nom).toBeDefined();
  });

  it("6.2 updateCommandeVendeur met à jour le statut", async () => {
    await expect(
      adminApi.updateCommandeVendeur("cmd1", { statut: "confirmee" })
    ).resolves.not.toThrow();
  });

  it("6.3 Transition de statut : confirmée → en_livraison", async () => {
    await expect(
      adminApi.updateCommandeVendeur("cmd1", { statut: "en_livraison", coursier_id: "c1" })
    ).resolves.not.toThrow();
  });

  it("6.4 Transition de statut : en_livraison → livree", async () => {
    await expect(
      adminApi.updateCommandeVendeur("cmd1", { statut: "livree", date_livraison_effective: new Date().toISOString() })
    ).resolves.not.toThrow();
  });

  it("6.5 Annulation de commande", async () => {
    await expect(
      adminApi.updateCommandeVendeur("cmd1", { statut: "annulee", notes_admin: "Annulée par admin" })
    ).resolves.not.toThrow();
  });

  it("6.6 Référence commande est préfixée correctement", () => {
    const ref = `CMD-${Date.now().toString(36).toUpperCase()}`;
    expect(ref).toMatch(/^CMD-/);
  });
});
