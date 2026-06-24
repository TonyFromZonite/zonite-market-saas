/**
 * AUDIT 28 — Garde-fou transactionnel : régularisation sans parrainage = ROLLBACK
 *
 * Vérifie que le trigger `trg_guard_regularisation_inclut_parrainage` sur
 * `ajustements_commission` :
 *   1) Rejette tout INSERT dont le motif matche /régularisation|audit cohérence/i
 *      et qui laisserait total_commissions_gagnees < (ventes + parrainage).
 *   2) Laisse passer les ajustements ponctuels (motif sans mot-clé d'audit).
 *   3) Laisse passer les régularisations qui RECHARGENT le parrainage.
 *
 * Test logique (replica JS de la fonction PL/pgSQL) + inspection SQL de la migration.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

interface Seller {
  id: string;
  total_commissions_gagnees: number;
  ventes_total: number;        // Σ ventes.commission_vendeur
  parrainage_total: number;    // Σ parrainages.commission_totale
}

interface AjustementInsert {
  vendeur_id: string;
  montant: number;
  motif: string;
  effectue_par: string;
}

const REGULARISATION_REGEX = /(régularisation|regularisation|audit cohérence|audit coherence)/i;

/** Replica JS de la fonction PL/pgSQL guard_regularisation_inclut_parrainage. */
export function guardRegularisationInclutParrainage(
  seller: Seller,
  ajust: AjustementInsert,
): { accepted: boolean; reason?: string; minimumLegitime: number; totalApres: number } {
  const isRegularisation = REGULARISATION_REGEX.test(ajust.motif);
  const totalApres = Math.max(0, seller.total_commissions_gagnees + ajust.montant);
  const minimumLegitime = seller.ventes_total + seller.parrainage_total;

  if (!isRegularisation) {
    return { accepted: true, minimumLegitime, totalApres };
  }
  if (ajust.montant < 0 && totalApres < minimumLegitime) {
    return {
      accepted: false,
      reason: `Régularisation rejetée : total_apres=${totalApres} < minimum_legitime=${minimumLegitime}`,
      minimumLegitime,
      totalApres,
    };
  }
  return { accepted: true, minimumLegitime, totalApres };
}

describe("AUDIT 28 — Garde-fou transactionnel régularisation + parrainage", () => {
  const baseSeller: Seller = {
    id: "e631aae2-26f3-46f0-b9b4-3c3e799067e1",
    total_commissions_gagnees: 7000,
    ventes_total: 6000,
    parrainage_total: 1000,
  };

  it("Le bug originel du 24/06 est désormais REJETÉ (lengue86 −1000)", () => {
    const res = guardRegularisationInclutParrainage(baseSeller, {
      vendeur_id: baseSeller.id,
      montant: -1000,
      motif: "Régularisation audit cohérence : écart non justifié par les ventes",
      effectue_par: "audit@zonite.org",
    });
    expect(res.accepted).toBe(false);
    expect(res.reason).toContain("Régularisation rejetée");
    expect(res.minimumLegitime).toBe(7000);
    expect(res.totalApres).toBe(6000);
  });

  it("Une régularisation qui RECHARGE le parrainage est acceptée", () => {
    const seller: Seller = { ...baseSeller, total_commissions_gagnees: 6000 };
    const res = guardRegularisationInclutParrainage(seller, {
      vendeur_id: seller.id,
      montant: 1000,
      motif: "Régularisation : recrédit commission parrainage non comptabilisée",
      effectue_par: "audit@zonite.org",
    });
    expect(res.accepted).toBe(true);
    expect(res.totalApres).toBe(7000);
  });

  it("Un ajustement admin ponctuel (motif sans 'régularisation') passe librement", () => {
    const res = guardRegularisationInclutParrainage(baseSeller, {
      vendeur_id: baseSeller.id,
      montant: -2000,
      motif: "Sanction : remboursement client suite à litige #4521",
      effectue_par: "admin@zonite.org",
    });
    expect(res.accepted).toBe(true);
  });

  it("Une régularisation qui RESTE au-dessus du minimum est acceptée", () => {
    const seller: Seller = { ...baseSeller, total_commissions_gagnees: 10000 };
    const res = guardRegularisationInclutParrainage(seller, {
      vendeur_id: seller.id,
      montant: -2000,
      motif: "Régularisation audit cohérence : annulation bonus exceptionnel",
      effectue_par: "audit@zonite.org",
    });
    expect(res.accepted).toBe(true);
    expect(res.totalApres).toBe(8000);
    expect(res.minimumLegitime).toBe(7000);
  });

  it("Vendeur sans parrainage : régularisation au niveau ventes acceptée", () => {
    const seller: Seller = {
      id: "x",
      total_commissions_gagnees: 8000,
      ventes_total: 6000,
      parrainage_total: 0,
    };
    const res = guardRegularisationInclutParrainage(seller, {
      vendeur_id: seller.id,
      montant: -2000,
      motif: "Régularisation : alignement sur ventes réelles",
      effectue_par: "audit@zonite.org",
    });
    expect(res.accepted).toBe(true);
    expect(res.totalApres).toBe(6000);
  });

  it("Une régularisation POSITIVE n'est jamais bloquée", () => {
    const seller: Seller = { ...baseSeller, total_commissions_gagnees: 3000 };
    const res = guardRegularisationInclutParrainage(seller, {
      vendeur_id: seller.id,
      montant: 4000,
      motif: "Régularisation audit cohérence : rattrapage",
      effectue_par: "audit@zonite.org",
    });
    expect(res.accepted).toBe(true);
  });

  it("Variantes orthographiques du motif sont toutes détectées", () => {
    const seller: Seller = { ...baseSeller, total_commissions_gagnees: 7000 };
    const variants = [
      "Régularisation X",
      "Regularisation Y",
      "Audit cohérence Z",
      "audit coherence W",
      "RÉGULARISATION en majuscules",
    ];
    for (const motif of variants) {
      const res = guardRegularisationInclutParrainage(seller, {
        vendeur_id: seller.id,
        montant: -500,
        motif,
        effectue_par: "audit@zonite.org",
      });
      expect(res.accepted, `motif="${motif}" devrait être rejeté`).toBe(false);
    }
  });

  it("Fuzz : 200 scénarios — aucun rejet faux-positif sur ajustements neutres", () => {
    for (let i = 0; i < 200; i++) {
      const ventes = Math.floor(Math.random() * 50000);
      const parrainage = Math.floor(Math.random() * 10000);
      const seller: Seller = {
        id: `fuzz-${i}`,
        ventes_total: ventes,
        parrainage_total: parrainage,
        total_commissions_gagnees: ventes + parrainage + Math.floor(Math.random() * 5000),
      };
      const delta = Math.floor(Math.random() * 4000) - 2000;
      const motif = i % 2 === 0 ? "Bonus performance" : "Sanction litige";
      const res = guardRegularisationInclutParrainage(seller, {
        vendeur_id: seller.id,
        montant: delta,
        motif,
        effectue_par: "admin",
      });
      // Motif ponctuel => toujours accepté
      expect(res.accepted).toBe(true);
    }
  });
});

describe("AUDIT 28 — Présence du trigger SQL en base", () => {
  it("La migration contient bien la fonction et le trigger", () => {
    const dir = join(process.cwd(), "supabase", "migrations");
    let foundFunction = false;
    let foundTrigger = false;
    let foundRaise = false;
    for (const f of readdirSync(dir)) {
      if (!f.endsWith(".sql")) continue;
      const sql = readFileSync(join(dir, f), "utf8");
      if (/guard_regularisation_inclut_parrainage/i.test(sql)) foundFunction = true;
      if (/trg_guard_regularisation_inclut_parrainage/i.test(sql)) foundTrigger = true;
      if (/RAISE EXCEPTION[\s\S]*Régularisation rejetée/i.test(sql)) foundRaise = true;
    }
    expect(foundFunction, "fonction garde-fou absente").toBe(true);
    expect(foundTrigger, "trigger garde-fou absent").toBe(true);
    expect(foundRaise, "RAISE EXCEPTION (rollback) absent").toBe(true);
  });
});
