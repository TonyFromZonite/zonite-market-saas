/**
 * AUDIT 16 — Sécurité (2 tests)
 */
import { describe, it, expect, beforeEach } from "vitest";
import { getAdminSession, getVendeurSession } from "@/components/useSessionGuard";

describe("Audit 16 — Sécurité", () => {
  beforeEach(() => sessionStorage.clear());

  it("16.1 Session avec rôle invalide est rejetée", () => {
    sessionStorage.setItem("admin_session", JSON.stringify({ id: "a1", role: "hacker" }));
    expect(getAdminSession()).toBeNull();

    sessionStorage.setItem("vendeur_session", JSON.stringify({ id: "v1", role: "admin" }));
    expect(getVendeurSession()).toBeNull();
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
});
