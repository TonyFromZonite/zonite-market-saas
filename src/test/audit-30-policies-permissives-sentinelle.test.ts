/**
 * AUDIT 30 — Sentinelle anti-policy permissive sur produits / ventes / sellers
 *
 * Objectif : échouer dès qu'une migration réintroduit une RLS policy permissive
 * qui rouvrirait l'une des 3 fuites déjà corrigées :
 *   - produits_prix_achat_exposed
 *   - ventes_prix_achat_exposed
 *   - sellers_update_privileged_fields
 *
 * Méthode (100% statique) :
 *   1) Parser TOUTES les migrations dans l'ordre chronologique.
 *   2) Reconstruire l'état "live" des policies en suivant CREATE / ALTER / DROP
 *      POLICY (et DROP TABLE ... CASCADE).
 *   3) Pour chaque policy survivante sur produits/ventes/sellers, classifier :
 *        - cible (TO) inclut authenticated / anon / public ?
 *        - commande (SELECT / UPDATE / ALL) ?
 *        - clause USING / WITH CHECK contient-elle is_admin_or_sous_admin /
 *          has_role(_, 'admin') / seller_self_update_only_safe ?
 *   4) Règles de REJET :
 *        R1. SELECT ou ALL sur produits/ventes pour authenticated/anon/public
 *            sans clause admin  ⇒  fuite prix_achat / marge / profit.
 *        R2. UPDATE ou ALL sur sellers pour authenticated/anon/public sans
 *            seller_self_update_only_safe ni clause admin
 *            ⇒  fuite escalade de privilèges (role/soldes/statuts).
 *
 * Ce test complète audit-29 : audit-29 vérifie les vues / colonnes /
 * helpers ; audit-30 vérifie la SURFACE POLICY elle-même de bout en bout.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");
const TARGET_TABLES = new Set(["produits", "ventes", "sellers"]);

type Policy = {
  name: string;
  table: string;
  command: string; // SELECT | INSERT | UPDATE | DELETE | ALL
  roles: string[]; // lowercased
  using: string;
  withCheck: string;
  migration: string;
};

function stripSqlComments(sql: string): string {
  return sql
    .replace(/--[^\n]*/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");
}

function readAllMigrations(): { name: string; sql: string }[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => ({ name: f, sql: stripSqlComments(readFileSync(join(MIGRATIONS_DIR, f), "utf8")) }));
}

/** Normalise un identifiant qualifié "public.produits" / `"sellers"` → "sellers". */
function normTable(raw: string): string {
  return raw.replace(/"/g, "").replace(/^public\./i, "").trim().toLowerCase();
}

/**
 * Extrait un bloc équilibré démarrant à la position d'une parenthèse ouvrante.
 * Renvoie le contenu entre parenthèses + l'index juste après la fermante.
 */
function readBalanced(sql: string, openIdx: number): { body: string; end: number } | null {
  if (sql[openIdx] !== "(") return null;
  let depth = 0;
  for (let i = openIdx; i < sql.length; i++) {
    const c = sql[i];
    if (c === "(") depth++;
    else if (c === ")") {
      depth--;
      if (depth === 0) return { body: sql.slice(openIdx + 1, i), end: i + 1 };
    }
  }
  return null;
}

/**
 * Parse un statement CREATE POLICY / ALTER POLICY.
 * Format attendu (souple) :
 *   CREATE POLICY "name" ON public.table
 *     [AS PERMISSIVE|RESTRICTIVE]
 *     [FOR SELECT|INSERT|UPDATE|DELETE|ALL]
 *     [TO role1, role2]
 *     [USING (expr)]
 *     [WITH CHECK (expr)];
 */
function parsePolicyStatement(stmt: string, migration: string): Policy | null {
  const m = stmt.match(
    /(?:CREATE|ALTER)\s+POLICY\s+("([^"]+)"|([A-Za-z_][\w]*))\s+ON\s+([A-Za-z0-9_."]+)/i
  );
  if (!m) return null;
  const name = (m[2] ?? m[3] ?? "").trim();
  const table = normTable(m[4]);
  if (!TARGET_TABLES.has(table)) return null;

  // Command
  const cmdMatch = stmt.match(/\bFOR\s+(SELECT|INSERT|UPDATE|DELETE|ALL)\b/i);
  const command = (cmdMatch?.[1] ?? "ALL").toUpperCase();

  // Roles
  const toMatch = stmt.match(/\bTO\s+([A-Za-z0-9_,\s"]+?)(?=\s+(?:USING|WITH\s+CHECK|AS\s+|FOR\s+|;|$))/i);
  const roles = toMatch
    ? toMatch[1]
        .split(",")
        .map((r) => r.replace(/"/g, "").trim().toLowerCase())
        .filter(Boolean)
    : ["public"]; // par défaut PostgreSQL = PUBLIC

  // USING (...)
  let using = "";
  const usingIdx = stmt.search(/\bUSING\s*\(/i);
  if (usingIdx >= 0) {
    const openIdx = stmt.indexOf("(", usingIdx);
    const blk = readBalanced(stmt, openIdx);
    if (blk) using = blk.body;
  }

  // WITH CHECK (...)
  let withCheck = "";
  const wcIdx = stmt.search(/\bWITH\s+CHECK\s*\(/i);
  if (wcIdx >= 0) {
    const openIdx = stmt.indexOf("(", wcIdx);
    const blk = readBalanced(stmt, openIdx);
    if (blk) withCheck = blk.body;
  }

  return { name, table, command, roles, using, withCheck, migration };
}

/** Découpe en statements top-level (ignore les `;` à l'intérieur de $$ ... $$). */
function splitStatements(sql: string): string[] {
  const out: string[] = [];
  let buf = "";
  let inDollar = false;
  let dollarTag = "";
  for (let i = 0; i < sql.length; i++) {
    const c = sql[i];
    if (!inDollar) {
      const m = sql.slice(i).match(/^\$([A-Za-z_]*)\$/);
      if (m) {
        inDollar = true;
        dollarTag = m[0];
        buf += dollarTag;
        i += dollarTag.length - 1;
        continue;
      }
      if (c === ";") {
        if (buf.trim()) out.push(buf.trim());
        buf = "";
        continue;
      }
      buf += c;
    } else {
      if (sql.slice(i).startsWith(dollarTag)) {
        buf += dollarTag;
        i += dollarTag.length - 1;
        inDollar = false;
        continue;
      }
      buf += c;
    }
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

/** Reconstruit l'état "live" des policies sur produits/ventes/sellers. */
function buildLivePolicyState(): Policy[] {
  // Clé : `${table}::${name}`
  const live = new Map<string, Policy>();
  const droppedTables = new Set<string>();

  for (const mig of readAllMigrations()) {
    const statements = splitStatements(mig.sql);
    for (const raw of statements) {
      const stmt = raw.replace(/\s+/g, " ").trim();

      // DROP TABLE ... CASCADE → toutes ses policies disparaissent
      const dropTbl = stmt.match(/^DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?([A-Za-z0-9_."]+)/i);
      if (dropTbl) {
        const t = normTable(dropTbl[1]);
        if (TARGET_TABLES.has(t)) {
          for (const k of Array.from(live.keys())) {
            if (k.startsWith(`${t}::`)) live.delete(k);
          }
          droppedTables.add(t);
        }
        continue;
      }

      // DROP POLICY [IF EXISTS] "name" ON table
      const dropPol = stmt.match(
        /^DROP\s+POLICY\s+(?:IF\s+EXISTS\s+)?("([^"]+)"|([A-Za-z_][\w]*))\s+ON\s+([A-Za-z0-9_."]+)/i
      );
      if (dropPol) {
        const name = (dropPol[2] ?? dropPol[3] ?? "").trim();
        const t = normTable(dropPol[4]);
        if (TARGET_TABLES.has(t)) live.delete(`${t}::${name}`);
        continue;
      }

      // CREATE POLICY / ALTER POLICY
      if (/^(CREATE|ALTER)\s+POLICY\b/i.test(stmt)) {
        const p = parsePolicyStatement(stmt, mig.name);
        if (p) live.set(`${p.table}::${p.name}`, p);
      }
    }
  }

  return Array.from(live.values());
}

const VENDOR_ROLES = new Set(["authenticated", "anon", "public"]);

function isAdminGuarded(expr: string): boolean {
  if (!expr) return false;
  const e = expr.toLowerCase();
  return (
    e.includes("is_admin_or_sous_admin") ||
    /has_role\s*\(\s*[^,]+,\s*'admin'\s*\)/.test(e) ||
    /has_role\s*\(\s*[^,]+,\s*'sous_admin'\s*\)/.test(e)
  );
}

function targetsVendorRoles(p: Policy): boolean {
  return p.roles.some((r) => VENDOR_ROLES.has(r));
}

describe("AUDIT 30 — Sentinelle policies permissives produits/ventes/sellers", () => {
  const policies = buildLivePolicyState();

  it("a bien reconstruit au moins quelques policies (sanity check du parser)", () => {
    expect(policies.length).toBeGreaterThan(0);
  });

  it("R1 — aucune policy SELECT/ALL permissive sur produits ou ventes", () => {
    const offenders = policies.filter((p) => {
      if (p.table !== "produits" && p.table !== "ventes") return false;
      if (!["SELECT", "ALL"].includes(p.command)) return false;
      if (!targetsVendorRoles(p)) return false;
      // Tolère explicitement les policies "Admins..." correctement gardées
      if (isAdminGuarded(p.using) || isAdminGuarded(p.withCheck)) return false;
      return true;
    });

    if (offenders.length > 0) {
      const detail = offenders
        .map(
          (o) =>
            `  - "${o.name}" sur ${o.table} (${o.command} TO ${o.roles.join(",")}) ` +
            `introduite/modifiée dans ${o.migration} ` +
            `USING=${o.using ? o.using.slice(0, 120) : "∅"}`
        )
        .join("\n");
      throw new Error(
        `Policies permissives détectées sur produits/ventes — réintroduction de la fuite prix_achat/marge_zonite :\n${detail}\n` +
          `→ Les vendeurs doivent UNIQUEMENT lire via les vues produits_public / ventes_vendeur_safe.`
      );
    }
    expect(offenders).toEqual([]);
  });

  it("R2 — aucune policy UPDATE/ALL sur sellers sans seller_self_update_only_safe ni clause admin", () => {
    const offenders = policies.filter((p) => {
      if (p.table !== "sellers") return false;
      if (!["UPDATE", "ALL"].includes(p.command)) return false;
      if (!targetsVendorRoles(p)) return false;
      const check = p.withCheck.toLowerCase();
      const using = p.using.toLowerCase();
      if (check.includes("seller_self_update_only_safe")) return false;
      if (isAdminGuarded(check) || isAdminGuarded(using)) return false;
      return true;
    });

    if (offenders.length > 0) {
      const detail = offenders
        .map(
          (o) =>
            `  - "${o.name}" sur sellers (${o.command} TO ${o.roles.join(",")}) ` +
            `introduite/modifiée dans ${o.migration} ` +
            `WITH CHECK=${o.withCheck ? o.withCheck.slice(0, 160) : "∅"}`
        )
        .join("\n");
      throw new Error(
        `Policies UPDATE permissives détectées sur sellers — escalade de privilèges possible :\n${detail}\n` +
          `→ Toute policy UPDATE accordée aux vendeurs DOIT inclure ` +
          `seller_self_update_only_safe(sellers.id, sellers.*) dans son WITH CHECK.`
      );
    }
    expect(offenders).toEqual([]);
  });

  it("R3 — aucune policy 'FOR ALL' permissive cumulant SELECT vendeur + UPDATE non gardé", () => {
    // Une policy FOR ALL TO authenticated sans aucune garde admin combine
    // automatiquement R1 et R2 ; on la liste explicitement pour clarté CI.
    const blanket = policies.filter(
      (p) =>
        p.command === "ALL" &&
        targetsVendorRoles(p) &&
        !isAdminGuarded(p.using) &&
        !isAdminGuarded(p.withCheck) &&
        !p.withCheck.toLowerCase().includes("seller_self_update_only_safe")
    );
    expect(
      blanket,
      `Policies FOR ALL permissives — surface d'attaque maximale : ${blanket
        .map((b) => `${b.table}.${b.name} (${b.migration})`)
        .join(", ")}`
    ).toEqual([]);
  });
});
