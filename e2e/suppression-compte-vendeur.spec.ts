/**
 * E2E — Suppression définitive du compte vendeur (Zone de danger)
 *
 * Vérifie via le vrai DOM rendu que le bouton « Supprimer définitivement
 * mon compte » :
 *   - n'apparaît jamais avant la validation KYC du vendeur ;
 *   - n'apparaît jamais pour le compte admin principal ;
 *   - apparaît seulement quand statut_kyc === 'valide' ET le statut vendeur
 *     est autorisé.
 *
 * Le test ne dépend pas du backend : la session vendeur est injectée dans
 * localStorage (la page ProfilVendeur lit la session via getVendeurSession),
 * et l'on intercepte les appels Supabase pour renvoyer un profil contrôlé.
 */
import { test, expect } from "@playwright/test";

type SessionOverrides = {
  email?: string;
  seller_status?: string;
  statut_kyc?: string | null;
};

const BUTTON_REGEX = /Supprimer définitivement mon compte/i;

async function seedSeller(page: import("@playwright/test").Page, overrides: SessionOverrides) {
  const seller = {
    id: "11111111-1111-1111-1111-111111111111",
    user_id: "22222222-2222-2222-2222-222222222222",
    email: overrides.email ?? "vendeur@test.com",
    full_name: "Vendeur Test",
    nom_complet: "Vendeur Test",
    role: "vendeur",
    seller_status: overrides.seller_status ?? "active_seller",
    statut_kyc: overrides.statut_kyc ?? null,
    telephone: "690000000",
    ville: "Douala",
    quartier: "Bonamoussadi",
    solde_commission: 0,
    solde_en_attente: 0,
    total_commissions_gagnees: 0,
    total_commissions_payees: 0,
    catalogue_debloque: true,
    training_completed: true,
    email_verified: true,
    wizard_completed: true,
  };

  // Inject session BEFORE the app boots
  await page.addInitScript((s) => {
    localStorage.setItem(
      "vendeur_session",
      JSON.stringify({
        id: s.id,
        user_id: s.user_id,
        email: s.email,
        nom_complet: s.full_name,
        role: "vendeur",
        seller_status: s.seller_status,
        statut_kyc: s.statut_kyc,
        telephone: s.telephone,
        catalogue_debloque: true,
        training_completed: true,
        solde_commission: 0,
        wizard_completed: true,
      })
    );
  }, seller);

  // Intercept Supabase REST calls to /sellers and return our controlled profile
  await page.route(/\/rest\/v1\/sellers.*/i, async (route) => {
    const url = route.request().url();
    if (route.request().method() !== "GET") return route.continue();
    const body = url.includes("count=") ? [{ count: 1 }] : [seller];
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "content-range": "0-0/1" },
      body: JSON.stringify(body),
    });
  });

  // Block any other Supabase write side-effects
  await page.route(/\/rest\/v1\//i, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
  );
}

test.describe("Suppression compte vendeur — Zone de danger", () => {
  test("absent avant validation KYC (statut_kyc=en_attente)", async ({ page }) => {
    await seedSeller(page, { statut_kyc: "en_attente" });
    await page.goto("/ProfilVendeur");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("button", { name: BUTTON_REGEX })).toHaveCount(0);
    await expect(page.getByText(/Zone de danger/i)).toHaveCount(0);
  });

  test("absent si KYC rejeté", async ({ page }) => {
    await seedSeller(page, { statut_kyc: "rejete" });
    await page.goto("/ProfilVendeur");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("button", { name: BUTTON_REGEX })).toHaveCount(0);
  });

  test("absent si KYC non soumis", async ({ page }) => {
    await seedSeller(page, { statut_kyc: null });
    await page.goto("/ProfilVendeur");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("button", { name: BUTTON_REGEX })).toHaveCount(0);
  });

  test("absent pour le compte admin principal même avec KYC validé", async ({ page }) => {
    await seedSeller(page, {
      email: "Tonykodjeu@gmail.com",
      statut_kyc: "valide",
    });
    await page.goto("/ProfilVendeur");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("button", { name: BUTTON_REGEX })).toHaveCount(0);
  });

  test("visible uniquement après validation KYC (statut_kyc=valide)", async ({ page }) => {
    await seedSeller(page, { statut_kyc: "valide", seller_status: "active_seller" });
    await page.goto("/ProfilVendeur");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(/Zone de danger/i)).toBeVisible();
    await expect(page.getByRole("button", { name: BUTTON_REGEX })).toBeVisible();
  });
});
