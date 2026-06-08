-- ============================================================
-- PRODUITS — restreint la lecture du prix d'achat aux admins
-- ============================================================
DROP POLICY IF EXISTS "Products viewable" ON public.produits;

CREATE POLICY "Admins read produits"
  ON public.produits FOR SELECT
  TO authenticated
  USING (public.is_admin_or_sous_admin(auth.uid()));

-- Vue publique pour les vendeurs : toutes les colonnes SAUF prix_achat
CREATE OR REPLACE VIEW public.produits_public
WITH (security_invoker = off) AS
SELECT
  id, nom, reference, description, details, categorie_id,
  prix_gros, prix_vente, stock_global, seuil_alerte_stock,
  stocks_par_localisation, variations, images, fournisseur,
  lien_telegram, actif, featured, created_at, updated_at,
  stocks_par_coursier
FROM public.produits;

GRANT SELECT ON public.produits_public TO anon, authenticated;

-- ============================================================
-- COURSIERS — masque téléphone/email aux vendeurs
-- ============================================================
DROP POLICY IF EXISTS "Coursiers viewable by authenticated" ON public.coursiers;

CREATE POLICY "Admins read coursiers"
  ON public.coursiers FOR SELECT
  TO authenticated
  USING (public.is_admin_or_sous_admin(auth.uid()));

-- Vue publique pour les vendeurs : toutes les colonnes SAUF telephone/email
CREATE OR REPLACE VIEW public.coursiers_public
WITH (security_invoker = off) AS
SELECT
  id, nom, ville_id, adresse_entrepot, zones_livraison_ids,
  actif, frais_livraison_defaut, created_at
FROM public.coursiers;

GRANT SELECT ON public.coursiers_public TO authenticated;

-- ============================================================
-- LIVRAISONS — admin-only (aucun usage côté vendeur dans le code)
-- ============================================================
DROP POLICY IF EXISTS "Livraisons viewable" ON public.livraisons;
-- L'ancienne policy "Admins manage livraisons" (FOR ALL) couvre déjà SELECT pour les admins.
