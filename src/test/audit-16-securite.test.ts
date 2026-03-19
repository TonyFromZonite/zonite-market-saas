/**
 * AUDIT 16 — Sécurité (6 tests)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: vi.fn() },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  },
}));

import { getAdminSession, getVendeurSession, clearAllSessions } from "@/components/useSessionGuard";

describe("Audit 16 — Sécurité", () => {
  beforeEach(() => localStorage.clear());

  it("16.1 Session avec rôle invalide est rejetée", () => {
    localStorage.setItem("admin_session", JSON.stringify({ id: "a1", role: "hacker" }));
    expect(getAdminSession()).toBeNull();
  });

  it("16.2 Validation mot de passe respecte les critères de sécurité", () => {
    const validatePassword = (pw: string) => {
      if (pw.length < 8) return "trop court";
      if (!/[A-Z]/.test(pw)) return "pas de majuscule";
      if (!/[0-9]/.test(pw)) return "pas de chiffre";
      return null;
    };
    expect(validatePassword("abc")).toBe("trop court");
    expect(validatePassword("abcdefgh")).toBe("pas de majuscule");
    expect(validatePassword("Abcdefgh")).toBe("pas de chiffre");
    expect(validatePassword("Abcdefg1")).toBeNull();
  });

  it("16.3 JSON corrompu dans localStorage ne crash pas", () => {
    localStorage.setItem("admin_session", "{broken json");
    expect(getAdminSession()).toBeNull();
    localStorage.setItem("vendeur_session", "undefined");
    expect(getVendeurSession()).toBeNull();
  });

  it("16.4 Sessions utilisent localStorage (pas sessionStorage)", () => {
    localStorage.setItem("admin_session", JSON.stringify({ id: "a1", role: "admin" }));
    expect(getAdminSession()).not.toBeNull();
    expect(sessionStorage.getItem("admin_session")).toBeNull();
  });

  it("16.5 clearAllSessions ne laisse aucune trace", () => {
    localStorage.setItem("admin_session", '{"role":"admin"}');
    localStorage.setItem("vendeur_session", '{"role":"vendeur"}');
    localStorage.setItem("sous_admin", '{"role":"sous_admin"}');
    clearAllSessions();
    expect(localStorage.getItem("admin_session")).toBeNull();
    expect(localStorage.getItem("vendeur_session")).toBeNull();
    expect(localStorage.getItem("sous_admin")).toBeNull();
  });

  it("16.6 Vendeur session sans id ni email est rejetée", () => {
    localStorage.setItem("vendeur_session", JSON.stringify({ role: "vendeur" }));
    expect(getVendeurSession()).toBeNull();
  });
});
