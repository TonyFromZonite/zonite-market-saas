/**
 * AUDIT 1 — Authentification (6 tests)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

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
    localStorage.clear();
  });

  it("1.1 Connexion admin valide stocke la session admin_session", () => {
    const adminData = { id: "a1", email: "admin@test.com", role: "admin", nom_complet: "Admin" };
    localStorage.setItem("admin_session", JSON.stringify(adminData));
    const session = getAdminSession();
    expect(session).not.toBeNull();
    expect(session?.role).toBe("admin");
  });

  it("1.2 Connexion vendeur valide stocke la session vendeur_session", () => {
    const vendeurData = { id: "v1", email: "vendeur@test.com", role: "vendeur", seller_status: "active_seller" };
    localStorage.setItem("vendeur_session", JSON.stringify(vendeurData));
    const session = getVendeurSession();
    expect(session).not.toBeNull();
    expect(session?.role).toBe("vendeur");
  });

  it("1.3 Connexion sous-admin valide stocke la session sous_admin", () => {
    const sousAdminData = { id: "sa1", email: "sous@test.com", role: "sous_admin", permissions: ["commandes"] };
    localStorage.setItem("sous_admin", JSON.stringify(sousAdminData));
    const session = getSousAdminSession();
    expect(session).not.toBeNull();
    expect(session?.role).toBe("sous_admin");
  });

  it("1.4 getActiveSession retourne la session prioritaire (admin > sous_admin > vendeur)", () => {
    const admin = { id: "a1", email: "a@t.com", role: "admin" };
    const vendeur = { id: "v1", email: "v@t.com", role: "vendeur" };
    localStorage.setItem("admin_session", JSON.stringify(admin));
    localStorage.setItem("vendeur_session", JSON.stringify(vendeur));
    const active = getActiveSession();
    expect(active?.type).toBe("admin");
  });

  it("1.5 clearAllSessions supprime toutes les sessions", () => {
    localStorage.setItem("admin_session", '{"role":"admin"}');
    localStorage.setItem("vendeur_session", '{"role":"vendeur"}');
    localStorage.setItem("sous_admin", '{"role":"sous_admin"}');
    clearAllSessions();
    expect(getAdminSession()).toBeNull();
    expect(getVendeurSession()).toBeNull();
    expect(getSousAdminSession()).toBeNull();
  });

  it("1.6 hasPermission retourne true pour admin, vérifie permissions pour sous_admin", () => {
    localStorage.setItem("admin_session", JSON.stringify({ id: "a1", role: "admin" }));
    expect(hasPermission(null, "commandes")).toBe(true);

    localStorage.clear();
    const sousAdmin = { id: "sa1", role: "sous_admin", permissions: ["commandes", "produits"] };
    expect(hasPermission(sousAdmin, "commandes")).toBe(true);
    expect(hasPermission(sousAdmin, "kyc")).toBe(false);
  });

  it("1.7 Sessions persistantes dans localStorage (pas sessionStorage)", () => {
    localStorage.setItem("vendeur_session", JSON.stringify({ id: "v1", email: "v@t.com", role: "vendeur" }));
    expect(getVendeurSession()).not.toBeNull();
    // sessionStorage ne doit pas être utilisé
    expect(sessionStorage.getItem("vendeur_session")).toBeNull();
  });

  it("1.8 Session invalide (JSON corrompu) retourne null", () => {
    localStorage.setItem("admin_session", "not-json");
    expect(getAdminSession()).toBeNull();
  });

  it("1.9 Session avec mauvais rôle est rejetée", () => {
    localStorage.setItem("admin_session", JSON.stringify({ id: "a1", role: "vendeur" }));
    expect(getAdminSession()).toBeNull();
  });

  it("1.10 Logout nettoie les sessions localStorage", () => {
    localStorage.setItem("vendeur_session", '{"id":"v1","role":"vendeur"}');
    localStorage.setItem("admin_session", '{"id":"a1","role":"admin"}');
    localStorage.setItem("sous_admin", '{"id":"s1","role":"sous_admin"}');
    clearAllSessions();
    expect(localStorage.getItem("vendeur_session")).toBeNull();
    expect(localStorage.getItem("admin_session")).toBeNull();
    expect(localStorage.getItem("sous_admin")).toBeNull();
  });
});
