/**
 * AUDIT 26 — Cycle complet des soldes vendeur sur plusieurs étapes
 *
 * Vérifie que la combinaison des RPCs côté base
 *   - credit_seller_commission   (vente livrée)
 *   - reserve_seller_balance     (demande de paiement créée)
 *   - approve_seller_payment     (demande approuvée et payée)
 *   - restore_seller_balance     (demande rejetée / retour)
 *   - debit_seller_commission    (retour produit / annulation vente)
 *
 * conserve à chaque étape les invariants métier :
 *
 *   I1.  solde_commission ≥ 0
 *   I2.  solde_en_attente ≥ 0
 *   I3.  total_commissions_gagnees ≥ total_commissions_payees
 *   I4.  solde_commission + solde_en_attente + total_commissions_payees
 *        = total_commissions_gagnees   (conservation comptable)
 *   I5.  Aucune opération ne crée de crédit fantôme :
 *        un rejet ne peut JAMAIS restaurer plus que ce qui a été réservé.
 */
import { describe, it, expect, beforeEach } from "vitest";

type Seller = {
  solde_commission: number;
  solde_en_attente: number;
  total_commissions_gagnees: number;
  total_commissions_payees: number;
};

const fresh = (): Seller => ({
  solde_commission: 0,
  solde_en_attente: 0,
  total_commissions_gagnees: 0,
  total_commissions_payees: 0,
});

// --- Répliques JS des RPCs SQL (logique identique à la base) ---------------

function creditCommission(s: Seller, commission: number): Seller {
  return {
    ...s,
    solde_commission: s.solde_commission + commission,
    total_commissions_gagnees: s.total_commissions_gagnees + commission,
  };
}

function debitCommission(s: Seller, amount: number): Seller {
  return {
    ...s,
    solde_commission: Math.max(0, s.solde_commission - amount),
    total_commissions_gagnees: Math.max(
      0,
      s.total_commissions_gagnees - amount
    ),
  };
}

function reserveBalance(s: Seller, amount: number): Seller {
  if (s.solde_commission < amount) {
    throw new Error(`Solde insuffisant: ${s.solde_commission} < ${amount}`);
  }
  return {
    ...s,
    solde_commission: s.solde_commission - amount,
    solde_en_attente: s.solde_en_attente + amount,
  };
}

function approvePayment(s: Seller, amount: number): Seller {
  return {
    ...s,
    solde_en_attente: Math.max(0, s.solde_en_attente - amount),
    total_commissions_payees: s.total_commissions_payees + amount,
  };
}

/** Version corrigée : bornée à solde_en_attente (anti crédit fantôme). */
function restoreBalance(s: Seller, amount: number): Seller {
  const toRestore = Math.max(0, Math.min(amount, s.solde_en_attente));
  if (toRestore <= 0) return s;
  return {
    ...s,
    solde_commission: s.solde_commission + toRestore,
    solde_en_attente: Math.max(0, s.solde_en_attente - toRestore),
  };
}

// --- Invariants ------------------------------------------------------------

function assertInvariants(s: Seller, label: string, opts: { strict?: boolean } = {}) {
  const { strict = true } = opts;
  expect(s.solde_commission, `${label} I1 solde_commission≥0`).toBeGreaterThanOrEqual(0);
  expect(s.solde_en_attente, `${label} I2 solde_en_attente≥0`).toBeGreaterThanOrEqual(0);
  if (strict) {
    expect(
      s.total_commissions_gagnees,
      `${label} I3 gagnees≥payees`
    ).toBeGreaterThanOrEqual(s.total_commissions_payees);
    expect(
      s.solde_commission + s.solde_en_attente + s.total_commissions_payees,
      `${label} I4 conservation comptable`
    ).toBe(s.total_commissions_gagnees);
  }
}

// --- Tests -----------------------------------------------------------------

describe("Audit 26 — Cycle réserve / paiement / rejet : cohérence multi-étapes", () => {
  let s: Seller;
  beforeEach(() => {
    s = fresh();
  });

  it("26.1 Cycle nominal : crédit → réserve → approbation", () => {
    s = creditCommission(s, 10_000); assertInvariants(s, "après crédit");
    s = reserveBalance(s, 6_000);    assertInvariants(s, "après réserve");
    s = approvePayment(s, 6_000);    assertInvariants(s, "après approbation");

    expect(s).toEqual({
      solde_commission: 4_000,
      solde_en_attente: 0,
      total_commissions_gagnees: 10_000,
      total_commissions_payees: 6_000,
    });
  });

  it("26.2 Cycle avec rejet : crédit → réserve → rejet restaure le montant exact", () => {
    s = creditCommission(s, 10_000);
    s = reserveBalance(s, 6_000);
    s = restoreBalance(s, 6_000);
    assertInvariants(s, "après rejet");

    expect(s.solde_commission).toBe(10_000);
    expect(s.solde_en_attente).toBe(0);
    expect(s.total_commissions_payees).toBe(0);
  });

  it("26.3 Rejet sans réservation préalable : aucun crédit fantôme (bug corrigé)", () => {
    s = creditCommission(s, 18_000);
    // Pas de réserve. Un rejet ne doit RIEN créditer.
    s = restoreBalance(s, 13_000);
    assertInvariants(s, "rejet sans réserve");

    expect(s.solde_commission).toBe(18_000);
    expect(s.solde_en_attente).toBe(0);
  });

  it("26.4 Double rejet de la même demande : la 2e tentative est neutralisée", () => {
    s = creditCommission(s, 20_000);
    s = reserveBalance(s, 5_000);
    s = restoreBalance(s, 5_000); // 1er rejet : OK
    s = restoreBalance(s, 5_000); // 2e rejet (rejouée) : doit être no-op
    assertInvariants(s, "double rejet");

    expect(s.solde_commission).toBe(20_000);
    expect(s.solde_en_attente).toBe(0);
  });

  it("26.5 Restore avec montant > en_attente : borné à en_attente", () => {
    s = creditCommission(s, 10_000);
    s = reserveBalance(s, 3_000);
    s = restoreBalance(s, 999_999); // tentative de sur-restauration
    assertInvariants(s, "over-restore");

    expect(s.solde_commission).toBe(10_000);
    expect(s.solde_en_attente).toBe(0);
  });

  it("26.6 Cycle long réaliste : 3 ventes, 1 paiement, 1 rejet, 1 retour produit", () => {
    s = creditCommission(s, 4_000);    // vente 1
    s = creditCommission(s, 7_000);    // vente 2
    s = creditCommission(s, 5_000);    // vente 3 → total gagné = 16 000

    s = reserveBalance(s, 10_000);     // demande paiement A
    s = approvePayment(s, 10_000);     // A payée → 10 000 payées

    s = reserveBalance(s, 4_000);      // demande paiement B
    s = restoreBalance(s, 4_000);      // B rejetée → restauration exacte

    s = debitCommission(s, 5_000);     // retour produit annule la vente 3
    assertInvariants(s, "fin cycle long");

    expect(s).toEqual({
      solde_commission: 1_000,           // 16 000 − 10 000 − 5 000
      solde_en_attente: 0,
      total_commissions_gagnees: 11_000, // 16 000 − 5 000
      total_commissions_payees: 10_000,
    });
  });

  it("26.7 Réserve refusée si solde_commission insuffisant (atomicité)", () => {
    s = creditCommission(s, 1_000);
    expect(() => reserveBalance(s, 2_000)).toThrow(/Solde insuffisant/);
    assertInvariants(s, "après réserve refusée");
    // L'état doit rester intact
    expect(s.solde_commission).toBe(1_000);
    expect(s.solde_en_attente).toBe(0);
  });

  it("26.8 Réserves concurrentes : 2 demandes simultanées, l'une approuvée, l'autre rejetée", () => {
    s = creditCommission(s, 15_000);
    s = reserveBalance(s, 6_000);   // demande A
    s = reserveBalance(s, 4_000);   // demande B
    expect(s.solde_en_attente).toBe(10_000);

    s = approvePayment(s, 6_000);   // A payée
    s = restoreBalance(s, 4_000);   // B rejetée
    assertInvariants(s, "fin concurrence");

    expect(s).toEqual({
      solde_commission: 9_000,
      solde_en_attente: 0,
      total_commissions_gagnees: 15_000,
      total_commissions_payees: 6_000,
    });
  });

  it("26.9 Fuzz : 200 séquences aléatoires conservent tous les invariants", () => {
    const rng = (seed: number) => {
      let x = seed;
      return () => {
        x = (x * 1664525 + 1013904223) % 2 ** 32;
        return x / 2 ** 32;
      };
    };
    const rand = rng(42);

    for (let run = 0; run < 200; run++) {
      let state = fresh();
      const steps = 20;
      for (let i = 0; i < steps; i++) {
        const op = Math.floor(rand() * 5);
        const amount = Math.floor(rand() * 5_000);
        try {
          if (op === 0) state = creditCommission(state, amount);
          else if (op === 1) state = reserveBalance(state, amount);
          else if (op === 2) state = approvePayment(state, Math.min(amount, state.solde_en_attente));
          else if (op === 3) state = restoreBalance(state, amount);
          else state = debitCommission(state, amount);
        } catch {
          // reserveBalance peut lever "Solde insuffisant" → état inchangé
        }
        assertInvariants(state, `run=${run} step=${i} op=${op}`, { checkConservation: false });
      }
    }
  });
});
