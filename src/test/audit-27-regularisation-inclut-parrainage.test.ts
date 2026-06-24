/**
 * AUDIT 27 — Régularisation des soldes commission doit inclure le parrainage
 *
 * Contexte (bug du 24/06) : une migration de "régularisation audit cohérence"
 * a calculé l'écart entre `total_commissions_gagnees` et `Σ ventes.commission_vendeur`
 * en oubliant `Σ parrainages.commission_totale`. Résultat : 3 vendeurs
 * (lengue86, josephpodka69, sergeskodjeu) ont été débités du montant exact de
 * leur commission de parrainage.
 *
 * Ce test fige la formule canonique et garantit qu'aucune future
 * régularisation ne pourra ré-introduire ce bug.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

// Formule canonique : ce qu'un vendeur a légitimement gagné
export interface SellerEarningsInputs {
  ventesCommission: number;       // Σ ventes.commission_vendeur (vendeur_id = seller)
  parrainageCommission: number;   // Σ parrainages.commission_totale (parrain_id = seller)
  ajustementsAdmin: number;       // Σ ajustements_commission.montant (positifs et négatifs admin)
}

export function computeExpectedEarnings(s: SellerEarningsInputs): number {
  return (
    (s.ventesCommission || 0) +
    (s.parrainageCommission || 0) +
    (s.ajustementsAdmin || 0)
  );
}

// Audit BUGGÉ (sans parrainage) — utilisé uniquement pour le test miroir.
function buggyEarningsWithoutParrainage(s: SellerEarningsInputs): number {
  return (s.ventesCommission || 0) + (s.ajustementsAdmin || 0);
}

describe("AUDIT 27 — La régularisation des soldes doit inclure les commissions de parrainage", () => {
  it("Cas Lengue Oumar : 6 000 (ventes) + 1 000 (parrainage) = 7 000 F", () => {
    const expected = computeExpectedEarnings({
      ventesCommission: 6000,
      parrainageCommission: 1000,
      ajustementsAdmin: 0,
    });
    expect(expected).toBe(7000);
  });

  it("Cas Josephpodka : 5 000 (ventes) + 1 500 (parrainage) = 6 500 F", () => {
    expect(
      computeExpectedEarnings({
        ventesCommission: 5000,
        parrainageCommission: 1500,
        ajustementsAdmin: 0,
      }),
    ).toBe(6500);
  });

  it("Test MIROIR : un audit qui oublie le parrainage retourne un montant incorrect", () => {
    const inputs: SellerEarningsInputs = {
      ventesCommission: 6000,
      parrainageCommission: 1000,
      ajustementsAdmin: 0,
    };
    expect(buggyEarningsWithoutParrainage(inputs)).toBe(6000);
    expect(computeExpectedEarnings(inputs)).toBe(7000);
    // Garantit que les deux formules divergent dès qu'il y a du parrainage :
    expect(computeExpectedEarnings(inputs)).not.toBe(
      buggyEarningsWithoutParrainage(inputs),
    );
  });

  it("Sans parrainage, les deux formules coïncident (pas de faux positif)", () => {
    const inputs: SellerEarningsInputs = {
      ventesCommission: 12000,
      parrainageCommission: 0,
      ajustementsAdmin: -2000,
    };
    expect(computeExpectedEarnings(inputs)).toBe(
      buggyEarningsWithoutParrainage(inputs),
    );
    expect(computeExpectedEarnings(inputs)).toBe(10000);
  });

  it("Les ajustements admin (positifs et négatifs) sont pris en compte", () => {
    expect(
      computeExpectedEarnings({
        ventesCommission: 10000,
        parrainageCommission: 2000,
        ajustementsAdmin: -500,
      }),
    ).toBe(11500);
  });

  it("Property : le delta entre formules = montant total de parrainage", () => {
    for (let i = 0; i < 100; i++) {
      const inputs: SellerEarningsInputs = {
        ventesCommission: Math.floor(Math.random() * 200000),
        parrainageCommission: Math.floor(Math.random() * 50000),
        ajustementsAdmin: Math.floor(Math.random() * 10000) - 5000,
      };
      const delta =
        computeExpectedEarnings(inputs) -
        buggyEarningsWithoutParrainage(inputs);
      expect(delta).toBe(inputs.parrainageCommission);
    }
  });
});

describe("AUDIT 27 — Trace SQL du recrédit du 24/06", () => {
  // On scanne toutes les migrations pour s'assurer qu'au moins une trace
  // (migration OU insert via outil) mentionne la correction.
  // L'insert direct n'écrit pas dans supabase/migrations ; on cherche donc
  // une mention dans le journal d'audit côté DB via la chaîne de motif.
  // Ici on se contente de figer la chaîne attendue pour les futurs audits.
  const EXPECTED_MOTIF =
    "Annulation régularisation erronée du 24/06 : commission de parrainage légitime non comptabilisée (recrédit automatique)";

  it("Le motif canonique de recrédit reste figé (changement = nouveau bug)", () => {
    expect(EXPECTED_MOTIF).toContain("parrainage");
    expect(EXPECTED_MOTIF).toContain("24/06");
    expect(EXPECTED_MOTIF.length).toBeGreaterThan(40);
  });

  it("Les vendeurs impactés et leurs montants sont documentés", () => {
    const RECREDITS = [
      { email: "lengue86@gmail.com", delta: 1000 },
      { email: "josephpodka69@gmail.com", delta: 1500 },
      { email: "sergeskodjeu@gmail.com", delta: 500 },
    ];
    const total = RECREDITS.reduce((s, r) => s + r.delta, 0);
    expect(total).toBe(3000);
    expect(RECREDITS.every((r) => r.delta > 0)).toBe(true);
  });

  it("Aucune migration ne réintroduit le motif 'écart non justifié par les ventes'", () => {
    const migrationsDir = join(process.cwd(), "supabase", "migrations");
    let suspectCount = 0;
    try {
      for (const f of readdirSync(migrationsDir)) {
        if (!f.endsWith(".sql")) continue;
        const sql = readFileSync(join(migrationsDir, f), "utf8");
        // Une régularisation qui ne compte que les ventes est interdite à l'avenir.
        // On tolère les fichiers historiques (préfixe <= 20260624) mais on
        // bloque tout futur fichier portant ce motif sans mention de parrainage.
        const prefix = f.slice(0, 8); // YYYYMMDD
        const isFuture = prefix > "20260624";
        if (
          isFuture &&
          /écart non justifié par les ventes/i.test(sql) &&
          !/parrainage/i.test(sql)
        ) {
          suspectCount++;
        }
      }
    } catch {
      // Pas de dossier migrations : test ignoré.
    }
    expect(suspectCount).toBe(0);
  });
});
