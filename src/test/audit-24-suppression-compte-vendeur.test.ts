/**
 * AUDIT 24 — Suppression définitive du compte vendeur (RGPD)
 *
 * Garantit que :
 *  - Le bouton de suppression n'est visible/actif que lorsque le statut
 *    du vendeur l'autorise (compte validé).
 *  - Le compte admin principal (Tonykodjeu@gmail.com) ne peut jamais être
 *    supprimé, même si l'appelant tente une auto-suppression.
 */
import { describe, it, expect } from "vitest";
import {
  canSelfDeleteAccount,
  isPrimaryAdminEmail,
  PRIMARY_ADMIN_EMAIL,
  SELF_DELETE_FORBIDDEN_STATUSES,
} from "@/lib/accountDeletion";

describe("Audit 24 — Suppression compte vendeur", () => {
  it("24.1 Bouton caché tant que le vendeur est en pending_verification", () => {
    expect(
      canSelfDeleteAccount({
        email: "v@test.com",
        seller_status: "pending_verification",
      })
    ).toBe(false);
  });

  it("24.2 Bouton caché si aucun statut n'est défini", () => {
    expect(canSelfDeleteAccount({ email: "v@test.com" })).toBe(false);
    expect(canSelfDeleteAccount(null)).toBe(false);
    expect(canSelfDeleteAccount(undefined)).toBe(false);
  });

  it("24.3 Bouton visible pour les statuts vendeur autorisés", () => {
    const allowed = [
      "kyc_required",
      "kyc_pending",
      "kyc_rejected",
      "kyc_approved_training_required",
      "active_seller",
    ];
    for (const seller_status of allowed) {
      expect(
        canSelfDeleteAccount({ email: "v@test.com", seller_status })
      ).toBe(true);
    }
  });

  it("24.4 L'admin principal ne peut JAMAIS être supprimé", () => {
    expect(isPrimaryAdminEmail("Tonykodjeu@gmail.com")).toBe(true);
    expect(isPrimaryAdminEmail("tonykodjeu@gmail.com")).toBe(true);
    expect(isPrimaryAdminEmail("  TONYKODJEU@GMAIL.COM  ")).toBe(true);

    // Même avec un statut autorisé, l'email admin bloque la suppression
    expect(
      canSelfDeleteAccount({
        email: "Tonykodjeu@gmail.com",
        seller_status: "active_seller",
      })
    ).toBe(false);
  });

  it("24.5 Autres emails ne sont pas considérés comme admin principal", () => {
    expect(isPrimaryAdminEmail("admin@zonite.org")).toBe(false);
    expect(isPrimaryAdminEmail("")).toBe(false);
    expect(isPrimaryAdminEmail(null as any)).toBe(false);
  });

  it("24.6 Constantes de sécurité non modifiées par erreur", () => {
    expect(PRIMARY_ADMIN_EMAIL).toBe("tonykodjeu@gmail.com");
    expect(SELF_DELETE_FORBIDDEN_STATUSES).toContain("pending_verification");
  });
});
