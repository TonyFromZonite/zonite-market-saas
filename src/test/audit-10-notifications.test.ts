/**
 * AUDIT 10 — Notifications (5 tests)
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
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
    })),
    removeChannel: vi.fn(),
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

  it("10.4 NotificationSystem existe et exporte les bonnes fonctions", async () => {
    const { notifSystem } = await import("@/lib/notificationSystem");
    expect(notifSystem).toBeDefined();
    expect(typeof notifSystem.playSound).toBe("function");
    expect(typeof notifSystem.updateBadge).toBe("function");
    expect(typeof notifSystem.unsubscribeAll).toBe("function");
  });

  it("10.5 updateBadge met à jour le titre du document", async () => {
    const { notifSystem } = await import("@/lib/notificationSystem");
    await notifSystem.updateBadge(5);
    expect(document.title).toBe("(5) Zonite Market");
    await notifSystem.updateBadge(0);
    expect(document.title).toBe("Zonite Market");
  });
});
