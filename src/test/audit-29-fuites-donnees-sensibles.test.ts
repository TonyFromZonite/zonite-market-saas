/**
 * AUDIT 29 — Anti-régression des 3 fuites de données sensibles
 *
 * Verrouille :
 *   1) Aucune migration ne réintroduit un SELECT vendeur sur public.produits
 *      ou public.ventes exposant prix_achat / prix_achat_unitaire / prix_gros /
 *      profit_zonite / marge_zonite.
 *   2) Les vues produits_public et ventes_vendeur_safe ne contiennent JAMAIS
 *      ces colonnes (inspection des CREATE VIEW dans les migrations).
 *   3) Aucune policy UPDATE sur public.sellers ne peut être créée pour les
 *      vendeurs sans appel à seller_self_update_only_safe dans le WITH CHECK.
 *   4) La fonction seller_self_update_only_safe existe, est SECURITY DEFINER,
 *      et son SQL référence bien toutes les colonnes privilégiées.
 *   5) Le code frontend des pages vendeur n'utilise PAS .from("produits")
 *      ni .from("ventes") directement — uniquement les vues sûres.
 *   6) L'event trigger trg_guard_no_seller_leak_policy est défini en migration.
 *
 * Couvre les findings supabase_lov :
 *   - produits_prix_achat_exposed
 *   - ventes_prix_achat_exposed
 *   - sellers_update_privileged_fields
 *
 * 100% statique (lit les fichiers du repo) — sûr en CI sans accès DB.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");
const SRC_DIR = join(process.cwd(), "src");

const FORBIDDEN_COLS_PRODUITS = ["prix_achat"];
const FORBIDDEN_COLS_VENTES = [
  "prix_achat",
  "prix_achat_unitaire",
  "prix_gros",
  "profit_zonite",
  "marge_zonite",
];
const PRIVILEGED_SELLER_COLS = [
  "role",
  "user_id",
  "email",
  "solde_commission",
  "solde_en_attente",
  "total_commissions_gagnees",
  "total_commissions_payees",
  "email_verified",
  "catalogue_debloque",
  "training_completed",
  "conditions_acceptees",
  "parraine_par",
  "statut_kyc",
  "seller_status",
];

// Pages frontend qui sont SERVIES À UN VENDEUR (jamais à un admin).
// Elles ne doivent jamais lire produits/ventes en direct.
const SELLER_FRONTEND_FILES = [
  "pages/CatalogueVendeur.jsx",
  "pages/ProduitDetail.jsx",
  "pages/MesCommandesVendeur.jsx",
  "pages/EspaceVendeur.jsx",
  "pages/NouvelleCommandeVendeur.jsx",
  "components/vendor/ShareProductModal.jsx",
];

function readAllMigrations(): { name: string; sql: string }[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .map((f) => ({
      name: f,
      sql: readFileSync(join(MIGRATIONS_DIR, f), "utf8"),
    }));
}

function stripSqlComments(sql: string): string {
  return sql
    .replace(/--[^\n]*/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");
}

/** Liste les blocs `CREATE POLICY ... ;` */
function extractPolicies(sql: string): string[] {
  const clean = stripSqlComments(sql);
  const re = /CREATE\s+POLICY[\s\S]*?(?=;)/gi;
  return clean.match(re) || [];
}

/** Liste les `DROP POLICY [IF EXISTS] "name" ON [public.]table` */
function extractDrops(sql: string): { policy: string; table: string }[] {
  const clean = stripSqlComments(sql);
  const re =
    /DROP\s+POLICY\s+(?:IF\s+EXISTS\s+)?"([^"]+)"\s+ON\s+(?:public\.)?(\w+)/gi;
  const out: { policy: string; table: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(clean))) out.push({ policy: m[1], table: m[2] });
  return out;
}

/** Reconstitue l'état "vivant" des policies en rejouant CREATE/DROP dans l'ordre. */
function liveCreatePolicies(
  migrations: { name: string; sql: string }[],
): { migration: string; sql: string; policy: string; table: string }[] {
  type Entry = { migration: string; sql: string; policy: string; table: string };
  const live = new Map<string, Entry>(); // key = `${table}::${policy}`
  for (const { name, sql } of migrations) {
    for (const pol of extractPolicies(sql)) {
      const nameMatch = pol.match(/CREATE\s+POLICY\s+"([^"]+)"\s+ON\s+(?:public\.)?(\w+)/i);
      if (!nameMatch) continue;
      const [, policy, table] = nameMatch;
      live.set(`${table}::${policy}`, { migration: name, sql: pol, policy, table });
    }
    for (const { policy, table } of extractDrops(sql)) {
      live.delete(`${table}::${policy}`);
    }
  }
  return [...live.values()];
}

/** Liste les blocs `CREATE [OR REPLACE] VIEW name AS ...` */
function extractViews(sql: string): { name: string; body: string }[] {
  const clean = stripSqlComments(sql);
  const re = /CREATE\s+(?:OR\s+REPLACE\s+)?VIEW\s+(?:public\.)?(\w+)[\s\S]*?(?=;)/gi;
  const out: { name: string; body: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(clean))) out.push({ name: m[1], body: m[0] });
  return out;
}

describe("AUDIT 29 — Anti-régression fuites données sensibles", () => {
  const migrations = readAllMigrations();

  describe("T1/T2 — Aucune policy SELECT vendeur sur produits/ventes", () => {
    it("aucune CREATE POLICY pour SELECT sur public.produits sans clause admin", () => {
      const offenders: string[] = [];
      for (const { name, sql } of migrations) {
        for (const pol of extractPolicies(sql)) {
          const onProduits = /ON\s+(public\.)?produits\b/i.test(pol);
          const isSelect = /FOR\s+(SELECT|ALL)\b/i.test(pol) || !/FOR\s+\w+/i.test(pol);
          if (!onProduits || !isSelect) continue;
          // Tolérer les policies admin-only
          if (/policyname?\s*=?\s*"?Admins/i.test(pol)) continue;
          const polNameMatch = pol.match(/CREATE\s+POLICY\s+"([^"]+)"/i);
          const polName = polNameMatch?.[1] || "";
          if (/^Admins?\b/i.test(polName)) continue;
          // Doit contenir un check admin
          if (
            !/is_admin_or_sous_admin/i.test(pol) &&
            !/has_role\s*\(/i.test(pol)
          ) {
            offenders.push(`${name} :: "${polName}"`);
          }
        }
      }
      expect(offenders, `Policies non-admin SELECT sur produits trouvées :\n${offenders.join("\n")}`).toEqual([]);
    });

    it("aucune CREATE POLICY pour SELECT sur public.ventes sans clause admin", () => {
      const offenders: string[] = [];
      for (const { name, sql } of migrations) {
        for (const pol of extractPolicies(sql)) {
          const onVentes = /ON\s+(public\.)?ventes\b/i.test(pol);
          const isSelect = /FOR\s+(SELECT|ALL)\b/i.test(pol) || !/FOR\s+\w+/i.test(pol);
          if (!onVentes || !isSelect) continue;
          const polNameMatch = pol.match(/CREATE\s+POLICY\s+"([^"]+)"/i);
          const polName = polNameMatch?.[1] || "";
          if (/^Admins?\b/i.test(polName)) continue;
          if (
            !/is_admin_or_sous_admin/i.test(pol) &&
            !/has_role\s*\(/i.test(pol)
          ) {
            offenders.push(`${name} :: "${polName}"`);
          }
        }
      }
      expect(offenders, `Policies non-admin SELECT sur ventes trouvées :\n${offenders.join("\n")}`).toEqual([]);
    });
  });

  describe("T3/T4 — Vues produits_public / ventes_vendeur_safe sans colonnes sensibles", () => {
    it("produits_public n'expose JAMAIS prix_achat", () => {
      const violations: string[] = [];
      for (const { name, sql } of migrations) {
        for (const view of extractViews(sql)) {
          if (view.name !== "produits_public") continue;
          for (const col of FORBIDDEN_COLS_PRODUITS) {
            // colonne en clair (non préfixée par autre identifiant)
            const re = new RegExp(`\\b${col}\\b`, "i");
            if (re.test(view.body)) {
              violations.push(`${name} :: produits_public contient ${col}`);
            }
          }
        }
      }
      expect(violations).toEqual([]);
    });

    it("ventes_vendeur_safe n'expose AUCUNE colonne de marge", () => {
      const violations: string[] = [];
      for (const { name, sql } of migrations) {
        for (const view of extractViews(sql)) {
          if (view.name !== "ventes_vendeur_safe") continue;
          for (const col of FORBIDDEN_COLS_VENTES) {
            const re = new RegExp(`\\b${col}\\b`, "i");
            if (re.test(view.body)) {
              violations.push(`${name} :: ventes_vendeur_safe contient ${col}`);
            }
          }
        }
      }
      expect(violations).toEqual([]);
    });

    it("au moins une migration crée chaque vue", () => {
      const allSql = migrations.map((m) => stripSqlComments(m.sql)).join("\n");
      expect(/CREATE\s+(OR\s+REPLACE\s+)?VIEW\s+(public\.)?produits_public/i.test(allSql)).toBe(true);
      expect(/CREATE\s+(OR\s+REPLACE\s+)?VIEW\s+(public\.)?ventes_vendeur_safe/i.test(allSql)).toBe(true);
    });
  });

  describe("T5/T6 — UPDATE sellers vendeur passe forcément par seller_self_update_only_safe", () => {
    it("aucune policy UPDATE sur sellers ouverte aux vendeurs sans le helper", () => {
      const offenders: string[] = [];
      for (const { name, sql } of migrations) {
        for (const pol of extractPolicies(sql)) {
          const onSellers = /ON\s+(public\.)?sellers\b/i.test(pol);
          const isUpdate = /FOR\s+(UPDATE|ALL)\b/i.test(pol);
          if (!onSellers || !isUpdate) continue;
          const polNameMatch = pol.match(/CREATE\s+POLICY\s+"([^"]+)"/i);
          const polName = polNameMatch?.[1] || "";
          // Admin policies OK
          if (/^Admins?\b/i.test(polName)) continue;
          if (
            /is_admin_or_sous_admin/i.test(pol) ||
            /has_role\s*\(/i.test(pol)
          )
            continue;
          // Policy ouverte aux vendeurs → DOIT mentionner le helper
          if (!/seller_self_update_only_safe/i.test(pol)) {
            offenders.push(`${name} :: "${polName}"`);
          }
        }
      }
      expect(offenders, `Policies UPDATE sellers sans helper anti-escalade :\n${offenders.join("\n")}`).toEqual([]);
    });
  });

  describe("T8 — Fonction seller_self_update_only_safe SECURITY DEFINER + couvre toutes les colonnes", () => {
    const allSql = migrations.map((m) => stripSqlComments(m.sql)).join("\n");
    const fnMatch = allSql.match(
      /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+public\.seller_self_update_only_safe[\s\S]*?\$\$/i,
    );

    it("la fonction est définie", () => {
      expect(fnMatch).not.toBeNull();
    });

    it("la fonction est SECURITY DEFINER", () => {
      expect(fnMatch?.[0]).toMatch(/SECURITY\s+DEFINER/i);
    });

    it("la fonction compare TOUTES les colonnes privilégiées", () => {
      const body = fnMatch?.[0] || "";
      const missing = PRIVILEGED_SELLER_COLS.filter((c) => !new RegExp(`\\b${c}\\b`, "i").test(body));
      expect(missing, `Colonnes oubliées dans seller_self_update_only_safe : ${missing.join(", ")}`).toEqual([]);
    });
  });

  describe("T9 — Event trigger trg_guard_no_seller_leak_policy défini en migration", () => {
    it("au moins une migration crée trg_guard_no_seller_leak_policy", () => {
      const allSql = migrations.map((m) => m.sql).join("\n");
      expect(/CREATE\s+EVENT\s+TRIGGER\s+trg_guard_no_seller_leak_policy/i.test(allSql)).toBe(true);
      expect(/guard_no_seller_leak_policy\s*\(\s*\)/i.test(allSql)).toBe(true);
    });
  });

  describe("T10 — Aucun accès direct vendeur à produits/ventes côté frontend", () => {
    for (const rel of SELLER_FRONTEND_FILES) {
      it(`${rel} n'utilise pas .from("produits") ni .from("ventes")`, () => {
        let content = "";
        try {
          content = readFileSync(join(SRC_DIR, rel), "utf8");
        } catch {
          // Fichier absent : skip (architecture peut évoluer)
          return;
        }
        // Strip comments
        const clean = content
          .replace(/\/\/[^\n]*/g, "")
          .replace(/\/\*[\s\S]*?\*\//g, "");
        expect(clean, `${rel} interroge produits en direct`).not.toMatch(
          /\.from\(\s*["']produits["']\s*\)/,
        );
        expect(clean, `${rel} interroge ventes en direct`).not.toMatch(
          /\.from\(\s*["']ventes["']\s*\)/,
        );
      });
    }
  });

  describe("T11 — La migration de fix initiale est toujours en place", () => {
    it("la suppression des policies vendeur est présente dans l'historique", () => {
      const allSql = migrations.map((m) => stripSqlComments(m.sql)).join("\n");
      expect(allSql).toMatch(/DROP\s+POLICY\s+IF\s+EXISTS\s+"Sellers read active products"\s+ON\s+public\.produits/i);
      expect(allSql).toMatch(/DROP\s+POLICY\s+IF\s+EXISTS\s+"Sellers read own ventes"\s+ON\s+public\.ventes/i);
      expect(allSql).toMatch(/DROP\s+POLICY\s+IF\s+EXISTS\s+"Users update own seller"\s+ON\s+public\.sellers/i);
    });

    it("la nouvelle policy stricte sur sellers existe", () => {
      const allSql = migrations.map((m) => stripSqlComments(m.sql)).join("\n");
      expect(allSql).toMatch(/CREATE\s+POLICY\s+"Users update own seller safe cols"/i);
    });
  });
});
