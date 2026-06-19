/**
 * Test d'intégration : flux admin → sous-admin
 *
 * 1. Admin crée un sous-administrateur via adminApi (insert sous_admins
 *    + insert user_roles + upsert admin_permissions).
 * 2. Les permissions enregistrées sont relues côté sous-admin
 *    (`getPermissionsForSousAdmin`).
 * 3. EspaceSousAdmin est monté avec la session sous-admin résultante
 *    et n'affiche QUE les modules autorisés ; les modules non
 *    sélectionnés sont absents du DOM.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// ── Stockage en mémoire pour simuler les tables ──────────────────────
const db = {
  sous_admins: [],
  user_roles: [],
  admin_permissions: [],
  commandes_vendeur: [],
};

const ok = (data) => Promise.resolve({ data, error: null });

const makeTable = (name) => {
  const table = name;
  let lastFilter = null;
  let pendingInsert = null;
  let pendingUpdate = null;

  const chain = {
    insert(rows) {
      const arr = Array.isArray(rows) ? rows : [rows];
      const inserted = arr.map((r, i) => ({ id: r.id || `${table}-${db[table].length + i + 1}`, ...r }));
      db[table].push(...inserted);
      pendingInsert = inserted;
      return {
        select: () => ({
          single: () => ok(inserted[0]),
          maybeSingle: () => ok(inserted[0]),
        }),
        then: (resolve) => resolve({ data: inserted, error: null }),
      };
    },
    update(values) {
      pendingUpdate = values;
      return {
        eq(col, val) {
          db[table] = db[table].map((r) => (r[col] === val ? { ...r, ...values } : r));
          return ok(null);
        },
      };
    },
    delete() {
      return {
        eq(col, val) {
          db[table] = db[table].filter((r) => r[col] !== val);
          return ok(null);
        },
      };
    },
    select() {
      const sel = {
        eq(col, val) {
          const rows = db[table].filter((r) => r[col] === val);
          return {
            maybeSingle: () => ok(rows[0] || null),
            single: () => ok(rows[0] || null),
            order: () => ok(rows),
            then: (resolve) => resolve({ data: rows, error: null }),
          };
        },
        order() {
          return ok([...db[table]]);
        },
        then(resolve) {
          return resolve({ data: [...db[table]], error: null });
        },
      };
      return sel;
    },
  };
  return chain;
};

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn((name) => makeTable(name)),
    rpc: vi.fn(() => ok([])),
    auth: {
      signUp: vi.fn(({ email }) =>
        ok({ user: { id: `auth-${email}`, email } })
      ),
      getUser: vi.fn(() => ok({ user: null })),
    },
    functions: { invoke: vi.fn(() => ok({})) },
  },
}));

// CacheManager / supabaseHelpers stubs pour EspaceSousAdmin
vi.mock("@/components/CacheManager", () => ({
  useCachedQuery: () => ({ data: [], loading: false }),
}));
vi.mock("@/lib/supabaseHelpers", () => ({
  filterTable: vi.fn(() => Promise.resolve([])),
}));

import { adminApi } from "@/components/adminApi";
import EspaceSousAdmin from "./EspaceSousAdmin";

const ALLOWED = ["CommandesVendeurs", "Produits"];
const FORBIDDEN = ["Livraisons", "SupportAdmin", "Vendeurs", "JournalAudit"];

describe("Flux Admin → SousAdmins : création + permissions + accès limité", () => {
  beforeEach(() => {
    db.sous_admins = [];
    db.user_roles = [];
    db.admin_permissions = [];
    db.commandes_vendeur = [];
    localStorage.clear();
  });

  afterEach(() => cleanup());

  it("crée le sous-admin avec permissions ciblées et limite l'accès en conséquence", async () => {
    // 1. Admin crée le sous-admin
    const created = await adminApi.createSousAdmin({
      full_name: "Jean Sous-Admin",
      nom_role: "Modérateur commandes",
      username: "jean.sa",
      email: "jean.sa@test.com",
    });
    expect(created?.id).toBeTruthy();
    expect(db.sous_admins).toHaveLength(1);

    // 2. Application des permissions
    await adminApi.upsertPermissionsForSousAdmin(
      created.id,
      "jean.sa@test.com",
      ALLOWED
    );
    expect(db.admin_permissions).toHaveLength(1);
    expect(db.admin_permissions[0].modules_autorises).toEqual(ALLOWED);

    // 3. Relecture des permissions persistées
    const perm = await adminApi.getPermissionsForSousAdmin(created.id);
    expect(perm?.modules_autorises).toEqual(ALLOWED);

    // 4. Connexion simulée : session sous_admin en localStorage
    localStorage.setItem(
      "sous_admin",
      JSON.stringify({
        id: created.id,
        email: "jean.sa@test.com",
        nom_complet: "Jean Sous-Admin",
        nom_role: "Modérateur commandes",
        role: "sous_admin",
        permissions: perm.modules_autorises,
      })
    );

    // 5. EspaceSousAdmin : seuls les modules autorisés sont visibles
    render(
      <MemoryRouter>
        <EspaceSousAdmin />
      </MemoryRouter>
    );

    expect(screen.getByText(/Jean Sous-Admin/)).toBeInTheDocument();
    expect(screen.getByText(/Modérateur commandes/)).toBeInTheDocument();

    // Modules AUTORISÉS visibles
    expect(screen.getByText("Commandes Vendeurs")).toBeInTheDocument();
    expect(screen.getByText("Produits")).toBeInTheDocument();

    // Modules NON autorisés absents du DOM
    for (const label of [
      "Livraisons",
      "Support Vendeurs",
      "Vendeurs",
      "Journal d'Audit",
    ]) {
      expect(screen.queryByText(label)).not.toBeInTheDocument();
    }

    // Le compteur affiche bien 2 modules
    expect(
      screen.getByText(/2\s*modules?\s*accessibles?/i)
    ).toBeInTheDocument();

    // 6. Sécurité : aucune permission "interdite" n'est présente en base
    for (const f of FORBIDDEN) {
      expect(db.admin_permissions[0].modules_autorises).not.toContain(f);
    }
  });
});
