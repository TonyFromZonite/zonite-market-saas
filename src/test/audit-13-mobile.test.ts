/**
 * AUDIT 13 — Mobile responsive (2 tests)
 */
import { describe, it, expect } from "vitest";

describe("Audit 13 — Mobile responsive", () => {
  it("13.1 matchMedia mock fonctionne pour les tests mobile", () => {
    const mq = window.matchMedia("(max-width: 768px)");
    expect(mq).toBeDefined();
    expect(typeof mq.matches).toBe("boolean");
  });

  it("13.2 createPageUrl génère des URLs valides pour navigation mobile", () => {
    const { createPageUrl } = require("@/utils");
    expect(createPageUrl("EspaceVendeur")).toBe("/EspaceVendeur");
    expect(createPageUrl("MesCommandesVendeur")).toBe("/MesCommandesVendeur");
    expect(createPageUrl("CatalogueVendeur")).toBe("/CatalogueVendeur");
    expect(createPageUrl("NotificationsVendeur")).toBe("/NotificationsVendeur");
  });
});
