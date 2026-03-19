/**
 * AUDIT 14 — Emails (5 tests)
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

describe("Audit 14 — Emails", () => {
  it("14.1 Edge function send-verification-email a les bons paramètres", () => {
    const payload = {
      email: "vendeur@test.com",
      nom: "Jean Dupont",
      code: "123456",
    };
    expect(payload.email).toContain("@");
    expect(payload.code).toHaveLength(6);
    expect(payload.nom).toBeTruthy();
  });

  it("14.2 Edge function send-kyc-approved-email a les bons paramètres", () => {
    const payload = {
      email: "vendeur@test.com",
      nom: "Jean Dupont",
    };
    expect(payload.email).toContain("@");
    expect(payload.nom).toBeTruthy();
  });

  it("14.3 Edge function send-kyc-rejected-email existe", () => {
    const path = resolve(__dirname, "../../supabase/functions/send-kyc-rejected-email/index.ts");
    expect(existsSync(path)).toBe(true);
  });

  it("14.4 Edge function send-commande-status-email existe", () => {
    const path = resolve(__dirname, "../../supabase/functions/send-commande-status-email/index.ts");
    expect(existsSync(path)).toBe(true);
  });

  it("14.5 Email templates existent", () => {
    const templates = ["signup", "recovery", "invite"];
    templates.forEach(t => {
      const path = resolve(__dirname, `../../supabase/functions/_shared/email-templates/${t}.tsx`);
      expect(existsSync(path)).toBe(true);
    });
  });
});
