/**
 * AUDIT 18 — Onboarding vendeur (6 tests)
 */
import { describe, it, expect } from "vitest";
import { canAccessFeature, SELLER_STATUSES, getRestrictionMessage, getRequiredModal } from "@/components/SellerStatusEngine";

describe("Audit 18 — Onboarding vendeur", () => {
  it("18.1 pending_verification bloque tout sauf rien", () => {
    expect(canAccessFeature(SELLER_STATUSES.PENDING_VERIFICATION, "dashboard")).toBe(false);
    expect(canAccessFeature(SELLER_STATUSES.PENDING_VERIFICATION, "catalog")).toBe(false);
    expect(canAccessFeature(SELLER_STATUSES.PENDING_VERIFICATION, "sales")).toBe(false);
  });

  it("18.2 getRestrictionMessage retourne un message pour statuts bloqués", () => {
    const msg = getRestrictionMessage(SELLER_STATUSES.KYC_PENDING, "sales");
    expect(msg).toBeTruthy();
    expect(typeof msg).toBe("string");
  });

  it("18.3 getRestrictionMessage retourne null pour accès autorisé", () => {
    expect(getRestrictionMessage(SELLER_STATUSES.ACTIVE_SELLER, "dashboard")).toBeNull();
  });

  it("18.4 getRequiredModal retourne le bon modal par statut", () => {
    expect(getRequiredModal(SELLER_STATUSES.PENDING_VERIFICATION)).toBe("email_verification");
    // KYC modals removed from auto-show — KYC only checked at payment request
    expect(getRequiredModal(SELLER_STATUSES.KYC_REQUIRED)).toBeNull();
    expect(getRequiredModal(SELLER_STATUSES.KYC_PENDING)).toBeNull();
  });

  it("18.5 active_seller n'a pas de modal requis", () => {
    expect(getRequiredModal(SELLER_STATUSES.ACTIVE_SELLER)).toBeNull();
  });

  it("18.6 Tous les statuts vendeur sont définis", () => {
    const statuts = Object.values(SELLER_STATUSES);
    expect(statuts.length).toBeGreaterThanOrEqual(5);
    expect(statuts).toContain("pending_verification");
    expect(statuts).toContain("active_seller");
    expect(statuts).toContain("kyc_pending");
  });
});
