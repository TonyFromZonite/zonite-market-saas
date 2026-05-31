import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import CommandesVendeurs from "./CommandesVendeurs";

vi.mock("@/components/useSessionGuard", () => ({
  requireAdminOrSousAdmin: vi.fn(),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

vi.mock("@/components/adminApi", () => ({
  adminApi: {
    updateCommandeVendeur: vi.fn(() => Promise.resolve()),
    createNotificationVendeur: vi.fn(() => Promise.resolve()),
    createJournalAudit: vi.fn(() => Promise.resolve()),
    createRetourProduit: vi.fn(() => Promise.resolve()),
  },
}));

const mockCommande = {
  id: "cmd-1",
  produit_nom: "Super Produit",
  produit_id: "prod-1",
  quantite: 2,
  prix_final_client: 10000,
  prix_unitaire: 5000,
  client_nom: "Jean Dupont",
  client_telephone: "690000000",
  client_ville: "Douala",
  client_quartier: "Akwa",
  client_adresse: "Rue 123",
  vendeur_id: "v1",
  vendeur_email: "vendeur@test.com",
  statut: "en_attente_validation_admin",
  reference_commande: "CMD-001",
  created_at: "2024-01-01T00:00:00Z",
  notes: "",
  notes_admin: "",
  livraison_incluse: false,
  frais_livraison: 1000,
  coursier_nom: "",
  sellers: { full_name: "Vendeur Test" },
  produits: { prix_gros: 3000, images: ["https://example.com/image.jpg"] },
};

const createChain = (data, error = null) => {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => ({
      then: (onFulfilled) => Promise.resolve({ data, error }).then(onFulfilled),
    })),
    single: vi.fn(() => Promise.resolve({ data, error })),
    then: (onFulfilled) => Promise.resolve({ data, error }).then(onFulfilled),
  };
  return chain;
};

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn((table) => {
      if (table === "commandes_vendeur") {
        return createChain([mockCommande]);
      }
      if (table === "coursiers") {
        return createChain([]);
      }
      if (table === "villes_cameroun") {
        return createChain([]);
      }
      return createChain(null);
    }),
    rpc: vi.fn(() => Promise.resolve({ data: null, error: null })),
    auth: { getUser: vi.fn(() => Promise.resolve({ data: { user: null }, error: null })) },
  },
}));

const renderWithQueryClient = (ui) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
};

describe("CommandesVendeurs — vignette produit dans le détail", () => {
  it("affiche la vignette du produit dans le dialogue de détail", async () => {
    renderWithQueryClient(<CommandesVendeurs />);

    // Attendre que la commande apparaisse dans la liste
    const produitText = await screen.findByText(/Super Produit/);
    expect(produitText).toBeInTheDocument();

    // Cliquer sur la ligne de commande pour ouvrir le dialogue
    fireEvent.click(produitText);

    // Vérifier que l'image de la vignette est affichée dans le dialogue
    const img = await screen.findByAltText("Super Produit");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "https://example.com/image.jpg");
    expect(img).toHaveClass("rounded-xl");
  });
});

describe("CommandesVendeurs — récapitulatif livraison dans le détail", () => {
  it("affiche le badge 'Livraison en sus' et la ligne des frais de livraison", async () => {
    renderWithQueryClient(<CommandesVendeurs />);

    const produitText = await screen.findByText(/Super Produit/);
    fireEvent.click(produitText);

    await waitFor(() => {
      expect(screen.getByText(/Livraison en sus/)).toBeInTheDocument();
    });

    expect(screen.getByText(/Frais de livraison/)).toBeInTheDocument();
    expect(screen.getByText(/à percevoir auprès du client/)).toBeInTheDocument();
  });

  it("affiche le badge 'Livraison incluse' et le libellé correspondant", async () => {
    const mockIncluse = { ...mockCommande, livraison_incluse: true };

    vi.mocked(supabase.from).mockImplementation((table) => {
      if (table === "commandes_vendeur") {
        return createChain([mockIncluse]);
      }
      if (table === "coursiers") {
        return createChain([]);
      }
      if (table === "villes_cameroun") {
        return createChain([]);
      }
      return createChain(null);
    });

    renderWithQueryClient(<CommandesVendeurs />);

    const produitText = await screen.findByText(/Super Produit/);
    fireEvent.click(produitText);

    await waitFor(() => {
      expect(screen.getByText(/Livraison incluse/)).toBeInTheDocument();
    });

    expect(screen.getByText(/Frais de livraison/)).toBeInTheDocument();
    expect(screen.getByText(/déjà inclus dans le prix client/)).toBeInTheDocument();
  });
});
