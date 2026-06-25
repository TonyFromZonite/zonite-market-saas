/**
 * E2E — Parcours vendeur (inscription + code email + KYC) et promotion admin.
 *
 * On ne dépend pas du backend : tous les appels Supabase (REST + Edge
 * Functions) sont interceptés et renvoient des réponses contrôlées. Cela
 * permet de tester le DOM rendu et les transitions d'état sans réseau.
 */
import { test, expect, type Page } from "@playwright/test";

const SELLER_ID = "11111111-1111-1111-1111-111111111111";
const USER_ID = "22222222-2222-2222-2222-222222222222";

// ───────────────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────────────

async function stubSupabaseAuth(page: Page) {
  // Auth endpoints (signInWithPassword, getUser, etc.) → succès silencieux
  await page.route(/\/auth\/v1\//i, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        access_token: "stub", refresh_token: "stub",
        token_type: "bearer", expires_in: 3600,
        user: { id: USER_ID, email: "marie@test.cm" },
      }),
    })
  );
}

async function seedAdminSession(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem(
      "admin_session",
      JSON.stringify({ role: "admin", id: "admin-1", email: "admin@test.cm" })
    );
  });
}

async function seedVendeurSession(
  page: Page,
  overrides: Partial<{ statut_kyc: string | null; seller_status: string }> = {}
) {
  await page.addInitScript((o) => {
    localStorage.setItem(
      "vendeur_session",
      JSON.stringify({
        id: "11111111-1111-1111-1111-111111111111",
        user_id: "22222222-2222-2222-2222-222222222222",
        email: "vendeur@test.cm",
        nom_complet: "Vendeur Test",
        full_name: "Vendeur Test",
        role: "vendeur",
        seller_status: o.seller_status ?? "active_seller",
        statut_kyc: o.statut_kyc ?? null,
        catalogue_debloque: true,
        training_completed: true,
        wizard_completed: true,
      })
    );
  }, overrides);
}

// ───────────────────────────────────────────────────────────────────────────
// 1. Inscription vendeur — étape 1 → étape 2 (code email)
// ───────────────────────────────────────────────────────────────────────────

test.describe("Inscription vendeur", () => {
  test("formulaire valide → passage à l'étape code email", async ({ page }) => {
    await stubSupabaseAuth(page);

    // Intercepte l'edge function register-seller
    let registerCalled = false;
    await page.route(/\/functions\/v1\/register-seller/i, async (route) => {
      registerCalled = true;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, seller_id: SELLER_ID }),
      });
    });
    // Toute autre route REST → vide
    await page.route(/\/rest\/v1\//i, (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
    );

    await page.goto("/InscriptionVendeur");
    await page.waitForSelector("#root *", { timeout: 15_000 });

    await page.getByPlaceholder("Ex: Marie Nguemo").fill("Marie Test");
    await page.getByPlaceholder("marie237").fill("marietest");
    await page.getByPlaceholder("votre@email.com").fill("marie@test.cm");
    await page.getByPlaceholder("Minimum 6 caractères").fill("MotDePasse123");

    await page.getByRole("button", { name: /Créer mon compte gratuit/i }).click();

    // Étape 2 affichée
    await expect(page.getByText(/Vérifiez votre email/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByPlaceholder("000000")).toBeVisible();
    expect(registerCalled).toBe(true);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 2. Vérification du code email (OTP 6 chiffres)
// ───────────────────────────────────────────────────────────────────────────

test.describe("Code email — vérification OTP", () => {
  test("code valide → redirection vers EspaceVendeur", async ({ page }) => {
    await stubSupabaseAuth(page);

    await page.route(/\/functions\/v1\/register-seller/i, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, seller_id: SELLER_ID }),
      })
    );
    await page.route(/\/functions\/v1\/verify-email-code/i, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          seller: {
            id: SELLER_ID,
            user_id: USER_ID,
            email: "marie@test.cm",
            full_name: "Marie Test",
            seller_status: "active_seller",
            statut_kyc: null,
            email_verified: true,
            wizard_completed: false,
          },
        }),
      })
    );
    await page.route(/\/rest\/v1\//i, (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
    );

    await page.goto("/InscriptionVendeur");
    await page.waitForSelector("#root *", { timeout: 15_000 });

    await page.getByPlaceholder("Ex: Marie Nguemo").fill("Marie Test");
    await page.getByPlaceholder("marie237").fill("marietest");
    await page.getByPlaceholder("votre@email.com").fill("marie@test.cm");
    await page.getByPlaceholder("Minimum 6 caractères").fill("MotDePasse123");
    await page.getByRole("button", { name: /Créer mon compte gratuit/i }).click();

    const otp = page.getByPlaceholder("000000");
    await expect(otp).toBeVisible({ timeout: 10_000 });

    const verifyBtn = page.getByRole("button", { name: /Vérifier/i });
    await expect(verifyBtn).toBeDisabled(); // bouton désactivé tant que 6 chiffres absents
    await otp.fill("123456");
    await expect(verifyBtn).toBeEnabled();

    await Promise.all([
      page.waitForURL(/\/EspaceVendeur/, { timeout: 10_000 }),
      verifyBtn.click(),
    ]);

    // La session vendeur a bien été posée par la page (preuve du succès OTP)
    const session = await page.evaluate(() => localStorage.getItem("vendeur_session"));
    expect(session).toContain(SELLER_ID);
  });

  test("code incomplet (<6 chiffres) → bouton Vérifier désactivé", async ({ page }) => {
    await stubSupabaseAuth(page);
    await page.route(/\/functions\/v1\/register-seller/i, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, seller_id: SELLER_ID }),
      })
    );
    await page.route(/\/rest\/v1\//i, (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
    );

    await page.goto("/InscriptionVendeur");
    await page.getByPlaceholder("Ex: Marie Nguemo").fill("Marie Test");
    await page.getByPlaceholder("marie237").fill("marietest");
    await page.getByPlaceholder("votre@email.com").fill("marie@test.cm");
    await page.getByPlaceholder("Minimum 6 caractères").fill("MotDePasse123");
    await page.getByRole("button", { name: /Créer mon compte gratuit/i }).click();

    await page.getByPlaceholder("000000").fill("123");
    await expect(page.getByRole("button", { name: /Vérifier/i })).toBeDisabled();
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 3. Ouverture du modal KYC côté admin (GestionKYC)
// ───────────────────────────────────────────────────────────────────────────

test.describe("Modal KYC admin", () => {
  test("clic sur « Voir » ouvre le dialogue KYC du vendeur sélectionné", async ({ page }) => {
    await stubSupabaseAuth(page);
    await seedAdminSession(page);

    const enAttenteSeller = {
      id: SELLER_ID,
      user_id: USER_ID,
      email: "vendeur@test.cm",
      full_name: "Vendeur EnAttente",
      role: "vendeur",
      seller_status: "kyc_pending",
      statut_kyc: "en_attente",
      ville: "Douala",
      quartier: "Bonamoussadi",
      telephone: "690000000",
      created_at: new Date().toISOString(),
      kyc_type_document: "cni",
      kyc_document_recto_url: null,
      kyc_document_verso_url: null,
      kyc_selfie_url: null,
    };

    await page.route(/\/rest\/v1\/sellers.*/i, async (route) => {
      if (route.request().method() !== "GET") return route.continue();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "content-range": "0-0/1" },
        body: JSON.stringify([enAttenteSeller]),
      });
    });
    await page.route(/\/rest\/v1\//i, (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
    );

    await page.goto("/GestionKYC");
    await page.waitForSelector("#root *", { timeout: 15_000 });

    // Ligne du vendeur en attente affichée
    await expect(page.getByText("Vendeur EnAttente")).toBeVisible({ timeout: 10_000 });

    // Clic sur « Voir » → modal s'ouvre
    await page.getByRole("button", { name: /Voir/i }).first().click();

    await expect(
      page.getByRole("dialog").getByText(/Dossier KYC : Vendeur EnAttente/i)
    ).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText(/Statut KYC actuel/i)).toBeVisible();
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 4. Promotion d'un vendeur en sous-admin (GestionAdmins)
// ───────────────────────────────────────────────────────────────────────────

test.describe("Promotion admin / sous-admin", () => {
  test("admin promeut un vendeur actif en sous-admin avec permissions", async ({ page }) => {
    await stubSupabaseAuth(page);
    await seedAdminSession(page);

    const candidateVendor = {
      id: SELLER_ID,
      user_id: USER_ID,
      email: "vendeur@test.cm",
      full_name: "Vendeur Promu",
      role: "vendeur",
      seller_status: "active_seller",
      statut_kyc: "valide",
    };

    // GET sellers (liste des candidats) ; GET sous_admins (déjà admins) → vide
    await page.route(/\/rest\/v1\/sellers.*/i, async (route) => {
      if (route.request().method() !== "GET") return route.continue();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "content-range": "0-0/1" },
        body: JSON.stringify([candidateVendor]),
      });
    });

    const writes: { table: string; method: string }[] = [];
    await page.route(/\/rest\/v1\/sous_admins(\?|$)/i, async (route) => {
      const req = route.request();
      if (req.method() === "GET") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          headers: { "content-range": "0-0/0" },
          body: "[]",
        });
      }
      writes.push({ table: "sous_admins", method: req.method() });
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        headers: { "content-range": "0-0/1" },
        body: JSON.stringify([{ id: "sa-1", email: candidateVendor.email }]),
      });
    });
    await page.route(/\/rest\/v1\/admin_permissions(\?|$)/i, async (route) => {
      writes.push({ table: "admin_permissions", method: route.request().method() });
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify([{ id: "perm-1" }]),
      });
    });
    await page.route(/\/rest\/v1\/user_roles(\?|$)/i, async (route) => {
      writes.push({ table: "user_roles", method: route.request().method() });
      await route.fulfill({
        status: route.request().method() === "GET" ? 200 : 201,
        contentType: "application/json",
        body: "[]",
      });
    });
    await page.route(/\/rest\/v1\/notifications_vendeur(\?|$)/i, (route) =>
      route.fulfill({ status: 201, contentType: "application/json", body: "[]" })
    );
    // Fallback REST
    await page.route(/\/rest\/v1\//i, (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
    );

    await page.goto("/GestionAdmins");
    await page.waitForSelector("#root *", { timeout: 15_000 });

    // Ouvrir le dialog de promotion
    await page.getByRole("button", { name: /Promouvoir un vendeur/i }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible();

    // Sélectionner le vendeur
    await page.getByText("Vendeur Promu").click();

    // Cocher au moins une permission (1re checkbox dans la liste des modules)
    const firstPerm = page.getByRole("dialog").locator('button[role="checkbox"]').first();
    await firstPerm.click();

    // Bouton « Promouvoir » dans le footer (pas le bouton d'ouverture)
    const promouvoirBtn = page.getByRole("dialog").getByRole("button", { name: /^Promouvoir$/ });
    await expect(promouvoirBtn).toBeEnabled();
    await promouvoirBtn.click();

    // L'INSERT sous_admins a bien été déclenché
    await expect.poll(() => writes.some((w) => w.table === "sous_admins" && w.method === "POST")).toBe(true);
    await expect.poll(() => writes.some((w) => w.table === "admin_permissions" && w.method === "POST")).toBe(true);
  });
});
