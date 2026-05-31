import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
      expect(screen.getAllByText(/Livraison en sus/).length).toBeGreaterThan(0);
    });

    expect(screen.getAllByText(/Frais de livraison/).length).toBeGreaterThan(0);
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
      expect(screen.getAllByText(/Livraison incluse/).length).toBeGreaterThan(0);
    });

    expect(screen.getAllByText(/Frais de livraison/).length).toBeGreaterThan(0);
    expect(screen.getByText(/déjà inclus dans le prix client/)).toBeInTheDocument();
  });
});

describe("CommandesVendeurs — édition livraison par l'admin", () => {
  it("affiche la section d'ajustement et applique la modification avec message vendeur", async () => {
    const updateMock = vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) }));
    const insertMock = vi.fn(() => Promise.resolve({ error: null }));

    vi.mocked(supabase.from).mockImplementation((table) => {
      if (table === "commandes_vendeur") {
        const chain = createChain([mockCommande]);
        chain.update = updateMock;
        return chain;
      }
      if (table === "notifications_vendeur") {
        return { insert: insertMock };
      }
      if (table === "coursiers" || table === "villes_cameroun") {
        return createChain([]);
      }
      return createChain(null);
    });

    renderWithQueryClient(<CommandesVendeurs />);
    const produitText = await screen.findByText(/Super Produit/);
    fireEvent.click(produitText);

    await waitFor(() => {
      expect(screen.getByText(/Ajuster les frais de livraison/)).toBeInTheDocument();
    });

    const btn = screen.getByRole("button", { name: /Appliquer la modification/ });
    expect(btn).toBeDisabled();

    const fraisInput = screen.getByPlaceholderText("0");
    fireEvent.change(fraisInput, { target: { value: "2500" } });

    const msgArea = screen.getByPlaceholderText(/Expliquez la raison/);
    fireEvent.change(msgArea, { target: { value: "Frais ajustés pour cette zone." } });

    await waitFor(() => expect(btn).not.toBeDisabled());

    fireEvent.click(btn);

    await waitFor(() => {
      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({ frais_livraison: 2500, livraison_incluse: false })
      );
      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          titre: "Modification des frais de livraison",
          vendeur_id: "v1",
        })
      );
    });
  });

  it("persiste les modifications et les ré-affiche après rechargement", async () => {
    // Simule une commande déjà modifiée en base (livraison incluse + frais 2500)
    const mockPersiste = {
      ...mockCommande,
      livraison_incluse: true,
      frais_livraison: 2500,
    };

    vi.mocked(supabase.from).mockImplementation((table) => {
      if (table === "commandes_vendeur") return createChain([mockPersiste]);
      if (table === "coursiers" || table === "villes_cameroun") return createChain([]);
      return createChain(null);
    });

    const { unmount } = renderWithQueryClient(<CommandesVendeurs />);
    const produitText = await screen.findByText(/Super Produit/);
    fireEvent.click(produitText);

    // Au rechargement : les valeurs persistées doivent être pré-remplies dans la section d'édition
    await waitFor(() => {
      expect(screen.getByText(/Ajuster les frais de livraison/)).toBeInTheDocument();
    });

    // Le champ frais reflète la valeur persistée (2500)
    const fraisInput = screen.getByPlaceholderText("0");
    expect(fraisInput).toHaveValue(2500);

    // Le bouton "Livraison incluse" est actif (sélectionné) — visuel emerald
    const btnIncluse = screen.getByRole("button", { name: "Livraison incluse" });
    expect(btnIncluse.className).toMatch(/emerald-600/);

    // Le récapitulatif affiche bien "déjà inclus dans le prix client" et le montant 2 500
    expect(screen.getByText(/déjà inclus dans le prix client/)).toBeInTheDocument();
    expect(screen.getAllByText(/2[\s ]500/).length).toBeGreaterThan(0);

    unmount();
  });

  it("recalcule la commission affichée selon livraison_incluse + frais_livraison au rechargement", async () => {
    // prix_final=10000, prix_gros=3000, quantité=2 → commission brute = 14 000
    // Cas 1 : livraison en sus → commission = 14 000
    vi.mocked(supabase.from).mockImplementation((table) => {
      if (table === "commandes_vendeur") {
        return createChain([{ ...mockCommande, livraison_incluse: false, frais_livraison: 2500 }]);
      }
      if (table === "coursiers" || table === "villes_cameroun") return createChain([]);
      return createChain(null);
    });

    const { unmount } = renderWithQueryClient(<CommandesVendeurs />);
    await screen.findByText(/Super Produit/);
    await waitFor(() => {
      expect(screen.getByText(/Commission:\s*14[\s ]000/)).toBeInTheDocument();
    });
    unmount();

    // Cas 2 : livraison incluse + 2500 → commission = 14 000 - 2 500 = 11 500
    vi.mocked(supabase.from).mockImplementation((table) => {
      if (table === "commandes_vendeur") {
        return createChain([{ ...mockCommande, livraison_incluse: true, frais_livraison: 2500 }]);
      }
      if (table === "coursiers" || table === "villes_cameroun") return createChain([]);
      return createChain(null);
    });

    renderWithQueryClient(<CommandesVendeurs />);
    const produit = await screen.findByText(/Super Produit/);
    await waitFor(() => {
      expect(screen.getByText(/Commission:\s*11[\s ]500/)).toBeInTheDocument();
    });

    // Détail : la commission vendeur affichée doit aussi être 11 500
    fireEvent.click(produit);
    await waitFor(() => {
      expect(screen.getByText(/Commission vendeur/)).toBeInTheDocument();
    });
    const detailCommissions = screen.getAllByText(/11[\s ]500/);
    expect(detailCommissions.length).toBeGreaterThan(0);
  });
});

describe("CommandesVendeurs — synchronisation commission liste/détail", () => {
  const cas = [
    { label: "livraison en sus, frais 0", livraison_incluse: false, frais_livraison: 0, attendu: /14[\s ]000/ },
    { label: "livraison en sus, frais 2500", livraison_incluse: false, frais_livraison: 2500, attendu: /14[\s ]000/ },
    { label: "livraison incluse, frais 1000", livraison_incluse: true, frais_livraison: 1000, attendu: /13[\s ]000/ },
    { label: "livraison incluse, frais 2500", livraison_incluse: true, frais_livraison: 2500, attendu: /11[\s ]500/ },
    { label: "livraison incluse, frais 5000", livraison_incluse: true, frais_livraison: 5000, attendu: /9[\s ]000/ },
  ];

  cas.forEach(({ label, livraison_incluse, frais_livraison, attendu }) => {
    it(`commission identique liste & détail après rechargement (${label})`, async () => {
      vi.mocked(supabase.from).mockImplementation((table) => {
        if (table === "commandes_vendeur") {
          return createChain([{ ...mockCommande, livraison_incluse, frais_livraison }]);
        }
        if (table === "coursiers" || table === "villes_cameroun") return createChain([]);
        return createChain(null);
      });

      renderWithQueryClient(<CommandesVendeurs />);
      const produit = await screen.findByText(/Super Produit/);

      // Commission visible dans la liste
      const ligneListe = await screen.findByText(/Commission:/);
      expect(ligneListe.textContent).toMatch(attendu);
      const montantListe = ligneListe.textContent.match(/Commission:\s*(.+)$/)[1].trim();

      // Ouvrir le détail
      fireEvent.click(produit);
      await waitFor(() => {
        expect(screen.getByText(/Commission vendeur/)).toBeInTheDocument();
      });

      // Commission visible dans le détail (élément suivant le label)
      const labelDetail = screen.getByText(/Commission vendeur/);
      const montantDetail = labelDetail.parentElement
        .querySelector("p:last-child")
        .textContent.trim();

      expect(montantDetail).toMatch(attendu);
      // Les deux montants doivent être strictement identiques
      expect(montantDetail).toBe(montantListe);
    });
  });
});
