import { test, expect } from "@playwright/test";

/**
 * Smoke test de pré-publication.
 * Vérifie que les routes critiques se chargent sans erreur console fatale
 * et rendent un contenu non vide.
 */
const ROUTES = [
  { path: "/TableauDeBord", label: "TableauDeBord" },
  { path: "/InscriptionVendeur", label: "InscriptionVendeur" },
  { path: "/EspaceVendeur", label: "EspaceVendeur" },
];

for (const route of ROUTES) {
  test(`smoke: ${route.label} se charge sans erreur fatale`, async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("pageerror", (err) => consoleErrors.push(`pageerror: ${err.message}`));
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        const text = msg.text();
        // On ignore les erreurs réseau Supabase/auth attendues sur routes protégées
        if (/Failed to load resource|401|403|net::ERR/i.test(text)) return;
        consoleErrors.push(text);
      }
    });

    const resp = await page.goto(route.path, { waitUntil: "domcontentloaded" });
    expect(resp, `pas de réponse HTTP pour ${route.path}`).not.toBeNull();
    expect(resp!.status(), `statut HTTP inattendu pour ${route.path}`).toBeLessThan(500);

    // Attend que le bundle React monte
    await page.waitForSelector("#root *", { timeout: 15_000 });
    const bodyText = (await page.locator("body").innerText()).trim();
    expect(bodyText.length, `page vide pour ${route.path}`).toBeGreaterThan(0);

    expect(consoleErrors, `erreurs console sur ${route.path}:\n${consoleErrors.join("\n")}`).toEqual([]);
  });
}
