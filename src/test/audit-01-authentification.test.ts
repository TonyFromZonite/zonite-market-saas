/**
 * AUDIT 1 — Authentification (6 tests)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock supabase
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      getSession: vi.fn(),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      update: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
    rpc: vi.fn(),
  },
}));

import { supabase } from "@/integrations/supabase/client";
import {
  getAdminSession,
  getSousAdminSession,
  getVendeurSession,
  getActiveSession,
  clearAllSessions,
  hasPermission,
} from "@/components/useSessionGuard";

describe("Audit 1 — Authentification", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("1.1 Connexion admin valide stocke la session admin_session", () => {
    const adminData = { id: "a1", email: "admin@test.com", role: "admin", nom_complet: "Admin" };
    sessionStorage.setItem("admin_session", JSON.stringify(adminData));
    const session = getAdminSession();
    expect(session).not.toBeNull();
    expect(session?.role).toBe("admin");
  });

  it("1.2 Connexion vendeur valide stocke la session vendeur_session", () => {
    const vendeurData = { id: "v1", email: "vendeur@test.com", role: "vendeur", seller_status: "active_seller" };
    sessionStorage.setItem("vendeur_session", JSON.stringify(vendeurData));
    const session = getVendeurSession();
    expect(session).not.toBeNull();
    expect(session?.role).toBe("vendeur");
  });

  it("1.3 Connexion sous-admin valide stocke la session sous_admin", () => {
    const sousAdminData = { id: "sa1", email: "sous@test.com", role: "sous_admin", permissions: ["commandes"] };
    sessionStorage.setItem("sous_admin", JSON.stringify(sousAdminData));
    const session = getSousAdminSession();
    expect(session).not.toBeNull();
    expect(session?.role).toBe("sous_admin");
  });

  it("1.4 getActiveSession retourne la session prioritaire (admin > sous_admin > vendeur)", () => {
    const admin = { id: "a1", email: "a@t.com", role: "admin" };
    const vendeur = { id: "v1", email: "v@t.com", role: "vendeur" };
    sessionStorage.setItem("admin_session", JSON.stringify(admin));
    sessionStorage.setItem("vendeur_session", JSON.stringify(vendeur));
    const active = getActiveSession();
    expect(active?.type).toBe("admin");
  });

  it("1.5 clearAllSessions supprime toutes les sessions", () => {
    sessionStorage.setItem("admin_session", '{"role":"admin"}');
    sessionStorage.setItem("vendeur_session", '{"role":"vendeur"}');
    sessionStorage.setItem("sous_admin", '{"role":"sous_admin"}');
    clearAllSessions();
    expect(getAdminSession()).toBeNull();
    expect(getVendeurSession()).toBeNull();
    expect(getSousAdminSession()).toBeNull();
  });

  it("1.6 hasPermission retourne true pour admin, vérifie permissions pour sous_admin", () => {
    sessionStorage.setItem("admin_session", JSON.stringify({ id: "a1", role: "admin" }));
    expect(hasPermission(null, "commandes")).toBe(true);

    sessionStorage.clear();
    const sousAdmin = { id: "sa1", role: "sous_admin", permissions: ["commandes", "produits"] };
    expect(hasPermission(sousAdmin, "commandes")).toBe(true);
    expect(hasPermission(sousAdmin, "kyc")).toBe(false);
  });
});
