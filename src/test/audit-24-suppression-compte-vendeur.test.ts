/**
 * AUDIT 24 — Suppression définitive du compte vendeur (RGPD)
 *
 * Le bouton « Supprimer mon compte » est disponible dès que l'email du vendeur
 * a été vérifié (peu importe l'état du KYC, conformément au RGPD) et ne doit
 * jamais permettre la suppression de l'admin principal.
 */
import { describe, it, expect } from "vitest";
import {
  canSelfDeleteAccount,
  isPrimaryAdminEmail,
  PRIMARY_ADMIN_EMAIL,
} from "@/lib/accountDeletion";

const baseSeller = (overrides: Record<string, any> = {}) => ({
  email: "vendeur@test.com",
  seller_status: "active_seller",
  statut_kyc: "valide",
  ...overrides,
});

describe("Audit 24 — Suppression compte vendeur", () => {
  it("24.1 Bouton caché tant que le vendeur est en pending_verification", () => {
    expect(canSelfDeleteAccount(baseSeller({ seller_status: "pending_verification" })))
      .toBe(false);
  });

  it("24.2 Bouton caché si aucun statut n'est défini", () => {
    expect(canSelfDeleteAccount({ email: "v@test.com", statut_kyc: "valide" })).toBe(false);
    expect(canSelfDeleteAccount(null)).toBe(false);
    expect(canSelfDeleteAccount(undefined)).toBe(false);
  });

  it("24.3 Bouton visible même si le KYC n'est pas encore validé (RGPD)", () => {
    for (const statut of [null, undefined, "non_soumis", "en_attente", "rejete", "valide"]) {
      expect(canSelfDeleteAccount(baseSeller({ statut_kyc: statut }))).toBe(true);
    }
  });

  it("24.4 L'admin principal ne peut JAMAIS être supprimé", () => {
    expect(isPrimaryAdminEmail("Tonykodjeu@gmail.com")).toBe(true);
    expect(isPrimaryAdminEmail("tonykodjeu@gmail.com")).toBe(true);
    expect(isPrimaryAdminEmail("  TONYKODJEU@GMAIL.COM  ")).toBe(true);
    expect(
      canSelfDeleteAccount(baseSeller({ email: "Tonykodjeu@gmail.com" }))
    ).toBe(false);
  });

  it("24.5 Constantes de sécurité non altérées", () => {
    expect(PRIMARY_ADMIN_EMAIL).toBe("tonykodjeu@gmail.com");
  });
});
