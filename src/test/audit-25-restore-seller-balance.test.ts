/**
 * AUDIT 25 — restore_seller_balance : invariants anti-crédits fantômes
 *
 * Vérifie que le RPC `restore_seller_balance` (corrigé le 24/06/2026) :
 *  - Ne recrédite JAMAIS plus que `solde_en_attente` réellement réservé.
 *  - Ne fait rien si aucune réservation n'existe (solde_en_attente = 0).
 *  - Borne la restauration à LEAST(_amount, solde_en_attente).
 *  - Préserve l'invariant : Δ(solde_commission) + Δ(solde_en_attente) = 0.
 *
 * Tests à deux niveaux :
 *  1. Invariants logiques modélisés en JS (réplique la nouvelle logique SQL).
 *  2. Inspection statique de la migration pour garantir que la garde
 *     `LEAST(_amount, solde_en_attente)` est bien présente côté base.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import path from "path";

/** Réplique exacte de la nouvelle logique SQL de restore_seller_balance. */
function restoreSellerBalance(
  state: { solde_commission: number; solde_en_attente: number },
  amount: number
): { solde_commission: number; solde_en_attente: number; restored: number } {
  const toRestore = Math.max(
    0,
    Math.min(amount ?? 0, state.solde_en_attente ?? 0)
  );
  if (toRestore <= 0) {
    return { ...state, restored: 0 };
  }
  return {
    solde_commission: (state.solde_commission ?? 0) + toRestore,
    solde_en_attente: Math.max(
      0,
      (state.solde_en_attente ?? 0) - toRestore
    ),
    restored: toRestore,
  };
}

describe("Audit 25 — restore_seller_balance (anti-crédits fantômes)", () => {
  it("25.1 Cas nominal : restaure exactement le montant réservé", () => {
    const before = { solde_commission: 5_000, solde_en_attente: 13_000 };
    const after = restoreSellerBalance(before, 13_000);
    expect(after.restored).toBe(13_000);
    expect(after.solde_commission).toBe(18_000);
    expect(after.solde_en_attente).toBe(0);
  });

  it("25.2 Aucune réservation : ne crédite RIEN (bug Owen Fotsing)", () => {
    // Scénario reproduit : rejet d'une demande de paiement alors que
    // solde_en_attente = 0 → l'ancien RPC créait +13 000 fantômes.
    const before = { solde_commission: 18_000, solde_en_attente: 0 };
    const after = restoreSellerBalance(before, 13_000);
    expect(after.restored).toBe(0);
    expect(after.solde_commission).toBe(18_000);
    expect(after.solde_en_attente).toBe(0);
  });

  it("25.3 Montant > réservation : borne à solde_en_attente", () => {
    const before = { solde_commission: 1_000, solde_en_attente: 5_000 };
    const after = restoreSellerBalance(before, 999_999);
    expect(after.restored).toBe(5_000);
    expect(after.solde_commission).toBe(6_000);
    expect(after.solde_en_attente).toBe(0);
  });

  it("25.4 Montant partiel ≤ réservation : restaure exactement le montant", () => {
    const before = { solde_commission: 2_000, solde_en_attente: 10_000 };
    const after = restoreSellerBalance(before, 4_000);
    expect(after.restored).toBe(4_000);
    expect(after.solde_commission).toBe(6_000);
    expect(after.solde_en_attente).toBe(6_000);
  });

  it("25.5 Montant nul ou négatif : ne touche à rien", () => {
    const before = { solde_commission: 10_000, solde_en_attente: 5_000 };
    expect(restoreSellerBalance(before, 0)).toMatchObject({
      restored: 0,
      solde_commission: 10_000,
      solde_en_attente: 5_000,
    });
    expect(restoreSellerBalance(before, -500)).toMatchObject({
      restored: 0,
      solde_commission: 10_000,
      solde_en_attente: 5_000,
    });
  });

  it("25.6 Invariant : Δ(solde_commission) + Δ(solde_en_attente) = 0", () => {
    const scenarios = [
      { state: { solde_commission: 0, solde_en_attente: 0 }, amount: 1_000 },
      { state: { solde_commission: 100, solde_en_attente: 50 }, amount: 200 },
      { state: { solde_commission: 500, solde_en_attente: 500 }, amount: 500 },
      { state: { solde_commission: 1, solde_en_attente: 9 }, amount: 3 },
    ];
    for (const { state, amount } of scenarios) {
      const after = restoreSellerBalance(state, amount);
      const delta =
        (after.solde_commission - state.solde_commission) +
        (after.solde_en_attente - state.solde_en_attente);
      expect(delta).toBe(0);
    }
  });

  it("25.7 Cycle réserve→rejet : retour exact à l'état initial", () => {
    // Simule reserve_seller_balance puis restore_seller_balance du même montant.
    const initial = { solde_commission: 20_000, solde_en_attente: 0 };
    const reserved = {
      solde_commission: initial.solde_commission - 7_000,
      solde_en_attente: initial.solde_en_attente + 7_000,
    };
    const restored = restoreSellerBalance(reserved, 7_000);
    expect(restored.solde_commission).toBe(initial.solde_commission);
    expect(restored.solde_en_attente).toBe(initial.solde_en_attente);
  });

  it("25.8 Migration SQL : la garde LEAST(_amount, solde_en_attente) est déployée", () => {
    const migrationsDir = path.resolve(
      process.cwd(),
      "supabase/migrations"
    );
    const files = readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    // Cherche la dernière migration qui (re)définit restore_seller_balance.
    let lastDefinition: string | null = null;
    for (const file of files) {
      const content = readFileSync(
        path.join(migrationsDir, file),
        "utf-8"
      );
      if (
        /FUNCTION\s+public\.restore_seller_balance/i.test(content) ||
        /FUNCTION\s+restore_seller_balance/i.test(content)
      ) {
        lastDefinition = content;
      }
    }

    expect(lastDefinition, "restore_seller_balance doit être défini dans une migration").not.toBeNull();
    // Garde anti-crédit fantôme : restauration bornée à solde_en_attente.
    expect(lastDefinition!).toMatch(/LEAST\s*\([^)]*solde_en_attente[^)]*\)/i);
    // La fonction doit verrouiller la ligne avant lecture (FOR UPDATE).
    expect(lastDefinition!).toMatch(/FOR\s+UPDATE/i);
  });
});
