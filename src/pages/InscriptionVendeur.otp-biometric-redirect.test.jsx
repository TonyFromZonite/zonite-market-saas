/**
 * E2E (intégration) :
 *  1. Saisie du code OTP → appel `verify-email-code` (mocké succès)
 *  2. Purge des flags biométriques d'un éventuel ancien utilisateur
 *  3. Redirection vers /EspaceVendeur (et NON vers /InscriptionVendeur)
 *  4. Aucune relance de l'AppLockScreen biométrique : les drapeaux
 *     `bio_enabled` / `zonite_bio_enrolled` ne sont plus présents,
 *     donc App.jsx ne verrouillerait pas le nouveau vendeur.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const toastMock = vi.fn();
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

const invokeMock = vi.fn();

vi.mock("@/integrations/supabase/client", () => {
  const SID = "seller-otp-bio";
  const sellerRow = {
    id: SID,
    email: "vendeur-bio@test.com",
    full_name: "Vendeur Bio",
    user_id: "user-bio-uuid",
  };

  const from = vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        maybeSingle: vi.fn(() => Promise.resolve({ data: sellerRow, error: null })),
        single: vi.fn(() => Promise.resolve({ data: sellerRow, error: null })),
      })),
    })),
    insert: vi.fn(() => Promise.resolve({ data: null, error: null })),
    update: vi.fn(() => ({
      eq: vi.fn(() => Promise.resolve({ data: null, error: null })),
    })),
  }));

  return {
    supabase: {
      from,
      rpc: vi.fn(() => Promise.resolve({ data: [], error: null })),
      auth: {
        signInWithPassword: vi.fn(() => Promise.resolve({ data: {}, error: null })),
      },
      functions: { invoke: invokeMock },
    },
  };
});

import InscriptionVendeur from "./InscriptionVendeur";

const SELLER_ID = "seller-otp-bio";
const CODE = "654321";



const originalLocation = window.location;

describe("InscriptionVendeur — flux OTP + biométrie → reste sur /EspaceVendeur", () => {
  let hrefAssigned = null;

  beforeEach(() => {
    window.history.replaceState({}, "", `/?verify=1&seller_id=${SELLER_ID}`);
    hrefAssigned = null;

    delete window.location;
    window.location = {
      ...originalLocation,
      search: `?verify=1&seller_id=${SELLER_ID}`,
      pathname: "/",
      assign: vi.fn((url) => { hrefAssigned = url; }),
      set href(v) { hrefAssigned = v; },
      get href() { return hrefAssigned || originalLocation.href; },
    };

    localStorage.clear();
    // Simule un précédent vendeur ayant activé la biométrie sur ce navigateur
    localStorage.setItem("bio_enabled", "true");
    localStorage.setItem("zonite_bio_enrolled", "1");
    localStorage.setItem("zonite_bio_cred_id", "ancien-cred-id");
    localStorage.setItem("zonite_bio_prompt_dismissed", "1");

    toastMock.mockClear();
    invokeMock.mockReset();
    invokeMock.mockImplementation((name) => {
      if (name === "verify-email-code") {
        return Promise.resolve({
          data: {
            success: true,
            seller: {
              id: SELLER_ID,
              email: "vendeur-bio@test.com",
              full_name: "Vendeur Bio",
              user_id: "user-bio-uuid",
              seller_status: "active_seller",
              statut_kyc: null,
              catalogue_debloque: false,
              training_completed: false,
              wizard_completed: false,
              telephone: null,
              solde_commission: 0,
            },
          },
          error: null,
        });
      }
      return Promise.resolve({ data: {}, error: null });
    });
  });

  afterEach(() => {
    window.location = originalLocation;
    cleanup();
  });

  it("redirige vers /EspaceVendeur, purge les flags biométriques et n'affiche pas l'erreur de redirection", async () => {
    const guardSpy = vi.fn();
    window.addEventListener("zonite:email-verified", guardSpy);

    render(
      <MemoryRouter>
        <InscriptionVendeur />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Vérifiez votre email/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText("000000"), { target: { value: CODE } });
    fireEvent.click(screen.getByRole("button", { name: /Vérifier/i }));

    // L'edge function de vérification serveur DOIT être appelée
    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith(
        "verify-email-code",
        expect.objectContaining({
          body: expect.objectContaining({ seller_id: SELLER_ID, code: CODE }),
        })
      );
    });

    // Redirection vers /EspaceVendeur (et SURTOUT pas vers InscriptionVendeur)
    await waitFor(() => {
      expect(hrefAssigned).toBe("/EspaceVendeur");
    });
    expect(hrefAssigned).not.toMatch(/InscriptionVendeur/);

    // Session vendeur correctement persistée avec user_id (sinon EmailVerifiedRouteGuard
    // ne pourrait pas confirmer email_verified et renverrait à InscriptionVendeur)
    const session = JSON.parse(localStorage.getItem("vendeur_session") || "{}");
    expect(session.id).toBe(SELLER_ID);
    expect(session.user_id).toBe("user-bio-uuid");
    expect(session.seller_status).toBe("active_seller");

    // Les anciens flags biométriques ont été purgés → l'AppLockScreen ne se
    // déclenchera pas au reload sur le nouveau vendeur.
    expect(localStorage.getItem("bio_enabled")).toBeNull();
    expect(localStorage.getItem("zonite_bio_enrolled")).toBeNull();
    expect(localStorage.getItem("zonite_bio_cred_id")).toBeNull();
    expect(localStorage.getItem("zonite_bio_prompt_dismissed")).toBeNull();

    // L'évènement de revalidation a été émis pour EmailVerifiedRouteGuard
    expect(guardSpy).toHaveBeenCalled();

    // Aucun message d'échec de redirection ne doit être affiché
    expect(
      screen.queryByText(/redirection automatique vers votre espace vendeur a échoué/i)
    ).not.toBeInTheDocument();

    window.removeEventListener("zonite:email-verified", guardSpy);
  });
});
