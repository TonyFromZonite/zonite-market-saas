/**
 * AUDIT 3 — Formation & Catalogue (4 tests)
 */
import { describe, it, expect } from "vitest";
import { canAccessFeature, SELLER_STATUSES, shouldShowTrainingModal } from "@/components/SellerStatusEngine";

describe("Audit 3 — Formation & Catalogue", () => {
  it("3.1 active_seller avec training complété accède au catalogue", () => {
    expect(canAccessFeature(SELLER_STATUSES.ACTIVE_SELLER, "catalog", true)).toBe(true);
  });

  it("3.2 Catalogue bloqué pour tous les statuts sauf active_seller", () => {
    expect(canAccessFeature(SELLER_STATUSES.PENDING_VERIFICATION, "catalog")).toBe(false);
    expect(canAccessFeature(SELLER_STATUSES.KYC_REQUIRED, "catalog")).toBe(false);
    expect(canAccessFeature(SELLER_STATUSES.KYC_PENDING, "catalog")).toBe(false);
    expect(canAccessFeature(SELLER_STATUSES.KYC_APPROVED_TRAINING_REQUIRED, "catalog")).toBe(false);
  });

  it("3.3 active_seller sans training ne peut pas accéder au catalogue", () => {
    expect(canAccessFeature(SELLER_STATUSES.ACTIVE_SELLER, "catalog", false)).toBe(false);
  });

  it("3.4 shouldShowTrainingModal pour active_seller sans training", () => {
    expect(shouldShowTrainingModal(SELLER_STATUSES.ACTIVE_SELLER, false)).toBe(true);
    expect(shouldShowTrainingModal(SELLER_STATUSES.ACTIVE_SELLER, true)).toBe(false);
  });
});
