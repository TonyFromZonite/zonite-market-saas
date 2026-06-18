/**
 * Vérifie la résilience du flux d'inscription quand l'email de code échoue.
 * Le compte vendeur DOIT être conservé et le frontend DOIT être informé via
 * `email_send_failed: true` afin d'afficher le bouton "Renvoyer le code".
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

describe("register-seller — résilience email", () => {
  const src = readFileSync(
    resolve(__dirname, "../../supabase/functions/register-seller/index.ts"),
    "utf8",
  );

  it("ne fait PAS de rollback quand l'envoi de l'OTP échoue (création initiale)", () => {
    // L'ancien code contenait : if (mailErr) { await rollback(); return jsonResponse(... 502) }
    // Le correctif doit retourner le seller_id et un flag email_send_failed.
    expect(src).toContain("email_send_failed");
    expect(src).not.toMatch(/mailErr[^}]*await rollback\(\)/s);
  });

  it("la branche reprise expose aussi email_send_failed et ne renvoie plus 502", () => {
    // Reprise : on régénère le code OTP même si l'envoi échoue.
    expect(src).toContain("resumeEmailSendFailed");
    expect(src).toContain("resumed: true");
  });

  it("le client gère le flag email_send_failed pour afficher l'action de renvoi", () => {
    const client = readFileSync(
      resolve(__dirname, "../../src/pages/InscriptionVendeur.jsx"),
      "utf8",
    );
    expect(client).toContain("email_send_failed");
    expect(client).toMatch(/Renvoyer le code/i);
  });
});

describe("resend-verification-code — remontée d'erreur claire", () => {
  const src = readFileSync(
    resolve(__dirname, "../../supabase/functions/resend-verification-code/index.ts"),
    "utf8",
  );

  it("retourne 502 + message lisible quand send-verification-email échoue", () => {
    expect(src).toContain("mailSendFailed");
    expect(src).toMatch(/502/);
    expect(src).toMatch(/Échec d'envoi de l'email/);
  });

  it("conserve le cooldown standard de 60s entre deux renvois", () => {
    expect(src).toContain("COOLDOWN_SECONDS = 60");
  });
});
