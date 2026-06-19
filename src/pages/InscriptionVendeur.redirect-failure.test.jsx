import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// ---- Mocks ----
const toastMock = vi.fn();
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

vi.mock("@/integrations/supabase/client", () => {
  const SELLER_ID = "seller-redirect-fail";
  const CODE = "123456";
  const sellerRow = {
    id: SELLER_ID,
    email: "vendeur@test.com",
    full_name: "Vendeur Test",
    email_verification_code: CODE,
    email_verification_expires_at: new Date(Date.now() + 60_000).toISOString(),
  };

  const from = vi.fn((table) => {
    if (table === "sellers") {
      return {
        // Initial useEffect load (etape 2 via ?verify=1&seller_id=...)
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(() => Promise.resolve({ data: sellerRow, error: null })),
            single: vi.fn(() => Promise.resolve({ data: sellerRow, error: null })),
          })),
        })),
        update: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ data: null, error: null })),
        })),
      };
    }
    return {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
          single: vi.fn(() => Promise.resolve({ data: null, error: null })),
        })),
      })),
      insert: vi.fn(() => Promise.resolve({ data: null, error: null })),
      update: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ data: null, error: null })) })),
    };
  });

  return {
    supabase: {
      from,
      rpc: vi.fn(() => Promise.resolve({ data: [], error: null })),
      auth: {
        signInWithPassword: vi.fn(() => Promise.resolve({ data: {}, error: null })),
      },
      functions: { invoke: vi.fn(() => Promise.resolve({ data: {}, error: null })) },
    },
  };
});

import InscriptionVendeur from "./InscriptionVendeur";

const originalLocation = window.location;

describe("InscriptionVendeur — gestion d'échec de redirection après code email", () => {
  beforeEach(() => {
    // Simuler la reprise du flux à l'étape 2 (code de vérification)
    window.history.replaceState({}, "", `/?verify=1&seller_id=${SELLER_ID}`);

    // Override window.location pour que toute affectation à href lève une erreur
    delete window.location;
    window.location = {
      ...originalLocation,
      search: `?verify=1&seller_id=${SELLER_ID}`,
      pathname: "/",
      assign: vi.fn(() => { throw new Error("blocked"); }),
      set href(_v) { throw new Error("redirection bloquée"); },
      get href() { return originalLocation.href; },
    };

    localStorage.clear();
    toastMock.mockClear();
  });

  afterEach(() => {
    window.location = originalLocation;
    cleanup();
  });

  it("affiche le message d'erreur et le bouton de continuation quand window.location.href échoue", async () => {
    render(
      <MemoryRouter>
        <InscriptionVendeur />
      </MemoryRouter>
    );

    // On atterrit directement à l'étape 2 via ?verify=1&seller_id=...
    await waitFor(() => {
      expect(screen.getByText(/Vérifiez votre email/i)).toBeInTheDocument();
    });

    // Saisir le code à 6 chiffres
    const codeInput = screen.getByPlaceholderText("000000");
    fireEvent.change(codeInput, { target: { value: CODE } });

    // Cliquer sur "Vérifier"
    const verifierBtn = screen.getByRole("button", { name: /Vérifier/i });
    fireEvent.click(verifierBtn);

    // Le message d'échec de redirection doit s'afficher
    await waitFor(() => {
      expect(
        screen.getByText(/redirection automatique vers votre espace vendeur a échoué/i)
      ).toBeInTheDocument();
    });

    // Le bouton de continuation manuelle doit être visible
    expect(
      screen.getByRole("button", { name: /Continuer vers mon espace vendeur/i })
    ).toBeInTheDocument();

    // Un toast destructif doit avoir été déclenché
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.stringMatching(/Redirection impossible/i),
        variant: "destructive",
      })
    );

    // La session vendeur a bien été persistée avant l'échec de redirection
    expect(localStorage.getItem("vendeur_session")).toBeTruthy();
  });
});
