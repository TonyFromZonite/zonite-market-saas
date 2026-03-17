/**
 * AUDIT 9 — Sous-admins (3 tests)
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  getSousAdminSession,
  hasPermission,
} from "@/components/useSessionGuard";

describe("Audit 9 — Sous-admins", () => {
  beforeEach(() => sessionStorage.clear());

  it("9.1 Session sous-admin valide est reconnue", () => {
    const sa = { id: "sa1", email: "sous@test.com", role: "sous_admin", permissions: ["commandes", "produits"] };
    sessionStorage.setItem("sous_admin", JSON.stringify(sa));
    expect(getSousAdminSession()).not.toBeNull();
  });

  it("9.2 hasPermission vérifie les modules autorisés", () => {
    const sa = { id: "sa1", role: "sous_admin", permissions: ["commandes", "kyc"] };
    expect(hasPermission(sa, "commandes")).toBe(true);
    expect(hasPermission(sa, "produits")).toBe(false);
  });

  it("9.3 Sous-admin sans permissions n'a accès à rien", () => {
    const sa = { id: "sa1", role: "sous_admin", permissions: [] };
    expect(hasPermission(sa, "commandes")).toBe(false);
    expect(hasPermission(sa, "kyc")).toBe(false);
  });
});
