/**
 * AUDIT 31 — Sentinelle anti-policy INSERT permissive sur
 * journal_audit / notifications_admin.
 *
 * Objectif : échouer dès qu'une migration réintroduit une RLS policy
 * laissant un utilisateur connecté (authenticated/anon/public) écrire
 * dans le journal d'audit (falsification de preuves) ou dans la boîte
 * de notifications admin (spam / obfuscation d'alertes).
 *
 * Tolère uniquement les policies explicitement gardées par
 * is_admin_or_sous_admin(...) ou has_role(..., 'admin'|'sous_admin').
 *
 * Complète le garde-fou DB `guard_no_audit_notif_insert_leak_trg` :
 * la CI échoue AVANT déploiement si la migration est dangereuse.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");
const TARGET_TABLES = new Set(["journal_audit", "notifications_admin"]);
const VENDOR_ROLES = new Set(["authenticated", "anon", "public"]);

type Policy = {
  name: string;
  table: string;
  command: string;
  roles: string[];
  using: string;
  withCheck: string;
  migration: string;
};

function stripSqlComments(sql: string): string {
  return sql.replace(/--[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
}

function normTable(raw: string): string {
  return raw.replace(/"/g, "").replace(/^public\./i, "").trim().toLowerCase();
}

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

function parsePolicyStatement(stmt: string, migration: string): Policy | null {
  const m = stmt.match(
    /(?:CREATE|ALTER)\s+POLICY\s+("([^"]+)"|([A-Za-z_][\w]*))\s+ON\s+([A-Za-z0-9_."]+)/i
  );
  if (!m) return null;
  const name = (m[2] ?? m[3] ?? "").trim();
  const table = normTable(m[4]);
  if (!TARGET_TABLES.has(table)) return null;

  const cmdMatch = stmt.match(/\bFOR\s+(SELECT|INSERT|UPDATE|DELETE|ALL)\b/i);
  const command = (cmdMatch?.[1] ?? "ALL").toUpperCase();

  const toMatch = stmt.match(
    /\bTO\s+([A-Za-z0-9_,\s"]+?)(?=\s+(?:USING|WITH\s+CHECK|AS\s+|FOR\s+|;|$))/i
  );
  const roles = toMatch
    ? toMatch[1].split(",").map((r) => r.replace(/"/g, "").trim().toLowerCase()).filter(Boolean)
    : ["public"];

  let using = "";
  const usingIdx = stmt.search(/\bUSING\s*\(/i);
  if (usingIdx >= 0) {
    const openIdx = stmt.indexOf("(", usingIdx);
    const blk = readBalanced(stmt, openIdx);
    if (blk) using = blk.body;
  }

  let withCheck = "";
  const wcIdx = stmt.search(/\bWITH\s+CHECK\s*\(/i);
  if (wcIdx >= 0) {
    const openIdx = stmt.indexOf("(", wcIdx);
    const blk = readBalanced(stmt, openIdx);
    if (blk) withCheck = blk.body;
  }

  return { name, table, command, roles, using, withCheck, migration };
}

function isAdminGuarded(expr: string): boolean {
  if (!expr) return false;
  const e = expr.toLowerCase();
  return (
    e.includes("is_admin_or_sous_admin") ||
    /has_role\s*\(\s*[^,]+,\s*'admin'\s*\)/.test(e) ||
    /has_role\s*\(\s*[^,]+,\s*'sous_admin'\s*\)/.test(e)
  );
}

function buildLivePolicyState(): Policy[] {
  const live = new Map<string, Policy>();
  const migrations = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => ({ name: f, sql: stripSqlComments(readFileSync(join(MIGRATIONS_DIR, f), "utf8")) }));

  for (const mig of migrations) {
    for (const raw of splitStatements(mig.sql)) {
      const stmt = raw.replace(/\s+/g, " ").trim();

      const dropTbl = stmt.match(/^DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?([A-Za-z0-9_."]+)/i);
      if (dropTbl) {
        const t = normTable(dropTbl[1]);
        if (TARGET_TABLES.has(t)) {
          for (const k of Array.from(live.keys())) {
            if (k.startsWith(`${t}::`)) live.delete(k);
          }
        }
        continue;
      }

      const dropPol = stmt.match(
        /^DROP\s+POLICY\s+(?:IF\s+EXISTS\s+)?("([^"]+)"|([A-Za-z_][\w]*))\s+ON\s+([A-Za-z0-9_."]+)/i
      );
      if (dropPol) {
        const name = (dropPol[2] ?? dropPol[3] ?? "").trim();
        const t = normTable(dropPol[4]);
        if (TARGET_TABLES.has(t)) live.delete(`${t}::${name}`);
        continue;
      }

      if (/^(CREATE|ALTER)\s+POLICY\b/i.test(stmt)) {
        const p = parsePolicyStatement(stmt, mig.name);
        if (p) live.set(`${p.table}::${p.name}`, p);
      }
    }
  }
  return Array.from(live.values());
}

describe("AUDIT 31 — Sentinelle INSERT permissif sur journal_audit / notifications_admin", () => {
  const policies = buildLivePolicyState();

  it("aucune policy INSERT/ALL permissive sur journal_audit ni notifications_admin", () => {
    const offenders = policies.filter((p) => {
      if (!["INSERT", "ALL"].includes(p.command)) return false;
      if (!p.roles.some((r) => VENDOR_ROLES.has(r))) return false;
      if (isAdminGuarded(p.withCheck) || isAdminGuarded(p.using)) return false;
      return true;
    });

    if (offenders.length > 0) {
      const detail = offenders
        .map(
          (o) =>
            `  - "${o.name}" sur ${o.table} (${o.command} TO ${o.roles.join(",")}) ` +
            `dans ${o.migration} — WITH CHECK=${o.withCheck ? o.withCheck.slice(0, 160) : "∅"}`
        )
        .join("\n");
      throw new Error(
        `Policies INSERT permissives détectées — falsification du journal d'audit ou spam admin possible :\n${detail}\n` +
          `→ Toute écriture doit passer par une fonction SECURITY DEFINER ou service_role.`
      );
    }
    expect(offenders).toEqual([]);
  });
});
