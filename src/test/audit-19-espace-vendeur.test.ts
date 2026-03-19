/**
 * AUDIT 19 — Espace vendeur (6 tests)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      update: vi.fn().mockReturnThis(),
    })),
  },
}));

import { getVendeurSession, getActiveSession } from "@/components/useSessionGuard";

describe("Audit 19 — Espace vendeur", () => {
  beforeEach(() => localStorage.clear());

  it("19.1 Session vendeur avec tous les champs requis", () => {
    const session = {
      id: "v1", user_id: "u1", email: "v@t.com", nom_complet: "Test",
      role: "vendeur", seller_status: "active_seller", solde_commission: 5000,
    };
    localStorage.setItem("vendeur_session", JSON.stringify(session));
    const s = getVendeurSession();
    expect(s?.id).toBe("v1");
    expect(s?.email).toBe("v@t.com");
  });

  it("19.2 getActiveSession retourne vendeur quand seul connecté", () => {
    localStorage.setItem("vendeur_session", JSON.stringify({ id: "v1", role: "vendeur", email: "v@t.com" }));
    const active = getActiveSession();
    expect(active?.type).toBe("vendeur");
  });

  it("19.3 Vendeur session est persistante (localStorage)", () => {
    localStorage.setItem("vendeur_session", JSON.stringify({ id: "v1", role: "vendeur", email: "v@t.com" }));
    // Simule fermeture/réouverture : localStorage persiste
    expect(localStorage.getItem("vendeur_session")).toBeTruthy();
    expect(getVendeurSession()).not.toBeNull();
  });

  it("19.4 Session vendeur mise à jour après changement de statut", () => {
    const session = { id: "v1", role: "vendeur", email: "v@t.com", seller_status: "kyc_pending" };
    localStorage.setItem("vendeur_session", JSON.stringify(session));
    // Simule mise à jour
    session.seller_status = "active_seller";
    localStorage.setItem("vendeur_session", JSON.stringify(session));
    expect(getVendeurSession()?.seller_status).toBe("active_seller");
  });

  it("19.5 Pas de session vendeur si non connecté", () => {
    expect(getVendeurSession()).toBeNull();
  });

  it("19.6 createPageUrl pour toutes les pages vendeur", async () => {
    const { createPageUrl } = await import("@/utils");
    const pages = ["EspaceVendeur", "ProfilVendeur", "AideVendeur", "DemandePaiement", "NouvelleCommandeVendeur"];
    pages.forEach(p => expect(createPageUrl(p)).toBe(`/${p}`));
  });
});
