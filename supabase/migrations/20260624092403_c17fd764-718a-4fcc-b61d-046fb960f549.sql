
-- Column-level revocations: even if someone later adds a permissive SELECT
-- policy, these columns remain unreachable to non-admin roles.

-- produits: cost, wholesale price, supplier name
REVOKE SELECT (prix_achat, prix_gros, fournisseur) ON public.produits FROM authenticated;
REVOKE SELECT (prix_achat, prix_gros, fournisseur) ON public.produits FROM anon;

-- ventes: Zonite-internal margin / cost data
REVOKE SELECT (profit_zonite, marge_zonite, prix_achat, prix_achat_unitaire, prix_gros)
  ON public.ventes FROM authenticated;
REVOKE SELECT (profit_zonite, marge_zonite, prix_achat, prix_achat_unitaire, prix_gros)
  ON public.ventes FROM anon;

-- candidatures_vendeur: internal admin notes
REVOKE SELECT (notes_admin) ON public.candidatures_vendeur FROM authenticated;
REVOKE SELECT (notes_admin) ON public.candidatures_vendeur FROM anon;

-- Make sure service_role and the admin path retain full access.
GRANT ALL ON public.produits TO service_role;
GRANT ALL ON public.ventes TO service_role;
GRANT ALL ON public.candidatures_vendeur TO service_role;

COMMENT ON COLUMN public.produits.prix_achat IS 'Admin-only (column REVOKE in place). Never expose to sellers.';
COMMENT ON COLUMN public.produits.prix_gros IS 'Admin-only (column REVOKE in place). Never expose to sellers.';
COMMENT ON COLUMN public.produits.fournisseur IS 'Admin-only (column REVOKE in place). Never expose to sellers.';
COMMENT ON COLUMN public.ventes.profit_zonite IS 'Admin-only (column REVOKE in place).';
COMMENT ON COLUMN public.ventes.marge_zonite IS 'Admin-only (column REVOKE in place).';
COMMENT ON COLUMN public.candidatures_vendeur.notes_admin IS 'Admin-only (column REVOKE in place).';
