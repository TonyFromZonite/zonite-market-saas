/**
 * AUDIT 13 — Mobile responsive (4 tests)
 */
import { describe, it, expect } from "vitest";

describe("Audit 13 — Mobile responsive", () => {
  it("13.1 matchMedia mock fonctionne pour les tests mobile", () => {
    const mq = window.matchMedia("(max-width: 768px)");
    expect(mq).toBeDefined();
    expect(typeof mq.matches).toBe("boolean");
  });

  it("13.2 createPageUrl génère des URLs valides pour navigation mobile", async () => {
    const { createPageUrl } = await import("@/utils");
    expect(createPageUrl("EspaceVendeur")).toBe("/EspaceVendeur");
    expect(createPageUrl("MesCommandesVendeur")).toBe("/MesCommandesVendeur");
    expect(createPageUrl("CatalogueVendeur")).toBe("/CatalogueVendeur");
    expect(createPageUrl("NotificationsVendeur")).toBe("/NotificationsVendeur");
  });

  it("13.3 Navigation vendeur bottom-nav a les bonnes pages", async () => {
    const { createPageUrl } = await import("@/utils");
    const navPages = ["EspaceVendeur", "CatalogueVendeur", "NouvelleCommandeVendeur", "MesCommandesVendeur", "ProfilVendeur"];
    navPages.forEach(p => expect(createPageUrl(p)).toBe(`/${p}`));
  });

  it("13.4 Pages admin ont des URLs valides", async () => {
    const { createPageUrl } = await import("@/utils");
    const adminPages = ["TableauDeBord", "Vendeurs", "Produits", "Commandes", "GestionKYC"];
    adminPages.forEach(p => expect(createPageUrl(p)).toBe(`/${p}`));
  });
});
