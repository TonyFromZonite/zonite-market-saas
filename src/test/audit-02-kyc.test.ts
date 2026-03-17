/**
 * AUDIT 2 — KYC Flow (6 tests)
 */
import { describe, it, expect } from "vitest";
import { canAccessFeature, SELLER_STATUSES } from "@/components/SellerStatusEngine";

describe("Audit 2 — KYC Flow", () => {
  it("2.1 kyc_required donne accès au dashboard (pour soumettre KYC)", () => {
    expect(canAccessFeature(SELLER_STATUSES.KYC_REQUIRED, "dashboard")).toBe(true);
  });

  it("2.2 kyc_pending bloque les ventes et le catalogue", () => {
    expect(canAccessFeature(SELLER_STATUSES.KYC_PENDING, "sales")).toBe(false);
    expect(canAccessFeature(SELLER_STATUSES.KYC_PENDING, "catalog")).toBe(false);
  });

  it("2.3 kyc_pending donne accès au dashboard", () => {
    expect(canAccessFeature(SELLER_STATUSES.KYC_PENDING, "dashboard")).toBe(true);
  });

  it("2.4 active_seller débloque ventes et dashboard", () => {
    expect(canAccessFeature(SELLER_STATUSES.ACTIVE_SELLER, "dashboard")).toBe(true);
    expect(canAccessFeature(SELLER_STATUSES.ACTIVE_SELLER, "sales")).toBe(true);
  });

  it("2.5 kyc_rejected donne accès au dashboard mais bloque ventes", () => {
    expect(canAccessFeature(SELLER_STATUSES.KYC_REJECTED, "dashboard")).toBe(true);
    expect(canAccessFeature(SELLER_STATUSES.KYC_REJECTED, "sales")).toBe(false);
    expect(canAccessFeature(SELLER_STATUSES.KYC_REJECTED, "catalog")).toBe(false);
  });

  it("2.6 kyc_rejected donne accès au profil pour resoumettre", () => {
    expect(canAccessFeature(SELLER_STATUSES.KYC_REJECTED, "profile")).toBe(true);
  });
});
