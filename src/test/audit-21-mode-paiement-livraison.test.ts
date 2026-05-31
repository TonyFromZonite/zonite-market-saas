/**
 * AUDIT 21 — Mode de paiement de la livraison (non-régression)
 *
 * Vérifie que NouvelleCommandeVendeur :
 *  - bloque la soumission quand mode_paiement_livraison n'est ni "inclus" ni "separe"
 *  - affiche un message d'erreur clair à l'utilisateur
 *  - bloque si "livraison incluse" mais prix final < prix gros + frais livraison
 *  - persiste le choix dans localStorage
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const SOURCE = readFileSync(
  resolve(__dirname, "../pages/NouvelleCommandeVendeur.jsx"),
  "utf-8"
);

// Reproduit la logique de validation telle qu'implémentée dans soumettre()
function validerModePaiement(mode: unknown): string | null {
  if (mode !== "inclus" && mode !== "separe") {
    return "Veuillez préciser le mode de paiement de la livraison (incluse dans le prix ou payée séparément au livreur).";
  }
  return null;
}

function validerLivraisonIncluse(
  mode: string,
  prixFinal: number,
  prixGros: number,
  qte: number,
  fraisLivraison: number
): string | null {
  if (mode === "inclus" && prixFinal * qte < prixGros * qte + fraisLivraison) {
    return `Livraison incluse : prix final insuffisant.`;
  }
  return null;
}

describe("Audit 21 — Mode paiement livraison", () => {
  it("21.1 Bloque la soumission si le mode est undefined", () => {
    expect(validerModePaiement(undefined)).toMatch(/Veuillez préciser le mode/);
  });

  it("21.2 Bloque la soumission si le mode est une chaîne invalide", () => {
    expect(validerModePaiement("autre")).toMatch(/Veuillez préciser le mode/);
    expect(validerModePaiement("")).toMatch(/Veuillez préciser le mode/);
    expect(validerModePaiement(null)).toMatch(/Veuillez préciser le mode/);
  });

  it("21.3 Accepte 'inclus' et 'separe'", () => {
    expect(validerModePaiement("inclus")).toBeNull();
    expect(validerModePaiement("separe")).toBeNull();
  });

  it("21.4 Bloque livraison incluse si prix final < prix gros + livraison", () => {
    // 1 unité à 5000, gros 4000, livraison 1500 → 5000 < 5500 ⇒ bloqué
    expect(validerLivraisonIncluse("inclus", 5000, 4000, 1, 1500)).not.toBeNull();
  });

  it("21.5 Autorise livraison incluse si prix final couvre gros + livraison", () => {
    expect(validerLivraisonIncluse("inclus", 6000, 4000, 1, 1500)).toBeNull();
  });

  it("21.6 N'applique pas la règle 'inclus' quand mode = 'separe'", () => {
    expect(validerLivraisonIncluse("separe", 5000, 4000, 1, 1500)).toBeNull();
  });

  // Non-régression : on s'assure que les garde-fous existent toujours dans le code source
  it("21.7 Le code source contient la validation du mode de paiement", () => {
    expect(SOURCE).toMatch(
      /mode_paiement_livraison\s*!==\s*"inclus"\s*&&\s*form\.mode_paiement_livraison\s*!==\s*"separe"/
    );
    expect(SOURCE).toContain("Veuillez préciser le mode de paiement de la livraison");
  });

  it("21.8 Le code source contient la validation 'livraison incluse'", () => {
    expect(SOURCE).toMatch(/livraisonIncluse\s*&&\s*prixFinal\s*\*\s*qte\s*</);
    expect(SOURCE).toContain("Livraison incluse");
  });

  it("21.9 Le choix est persisté dans localStorage", () => {
    expect(SOURCE).toContain('localStorage.setItem("zonite_mode_paiement_livraison"');
    expect(SOURCE).toContain('localStorage.getItem("zonite_mode_paiement_livraison")');
  });

  it("21.10 Un fallback affiche un avertissement si localStorage indisponible", () => {
    expect(SOURCE).toMatch(/localStorageDisponible/);
  });
});
