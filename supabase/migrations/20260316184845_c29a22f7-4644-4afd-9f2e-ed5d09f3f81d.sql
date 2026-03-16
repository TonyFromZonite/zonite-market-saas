
-- =============================================
-- PHASE 2: COMPLETE DATABASE REBUILD
-- =============================================

-- Drop existing tables in correct order (respecting FK constraints)
DROP TABLE IF EXISTS paiements_commission CASCADE;
DROP TABLE IF EXISTS demandes_paiement_vendeur CASCADE;
DROP TABLE IF EXISTS mouvements_stock CASCADE;
DROP TABLE IF EXISTS retours_produit CASCADE;
DROP TABLE IF EXISTS ventes CASCADE;
DROP TABLE IF EXISTS commandes_vendeur CASCADE;
DROP TABLE IF EXISTS notifications_vendeur CASCADE;
DROP TABLE IF EXISTS notifications_admin CASCADE;
DROP TABLE IF EXISTS tickets_support CASCADE;
DROP TABLE IF EXISTS faq_items CASCADE;
DROP TABLE IF EXISTS admin_permissions CASCADE;
DROP TABLE IF EXISTS sous_admins CASCADE;
DROP TABLE IF EXISTS user_roles CASCADE;
DROP TABLE IF EXISTS produits CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS livraisons CASCADE;
DROP TABLE IF EXISTS zones CASCADE;
DROP TABLE IF EXISTS candidatures_vendeur CASCADE;
DROP TABLE IF EXISTS statistiques_journalieres CASCADE;
DROP TABLE IF EXISTS journal_audit CASCADE;
DROP TABLE IF EXISTS config_app CASCADE;
DROP TABLE IF EXISTS coursiers CASCADE;
DROP TABLE IF EXISTS sellers CASCADE;

-- Drop existing functions
DROP FUNCTION IF EXISTS public.has_role CASCADE;
DROP FUNCTION IF EXISTS public.get_seller_role CASCADE;
DROP FUNCTION IF EXISTS public.update_updated_at_column CASCADE;

-- =============================================
-- TABLES
-- =============================================

CREATE TABLE public.sellers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  telephone TEXT,
  whatsapp TEXT,
  ville TEXT,
  quartier TEXT,
  numero_mobile_money TEXT,
  operateur_mobile_money TEXT DEFAULT 'orange_money',
  seller_status TEXT NOT NULL DEFAULT 'pending_verification',
  statut_kyc TEXT DEFAULT 'en_attente',
  email_verified BOOLEAN DEFAULT false,
  training_completed BOOLEAN DEFAULT false,
  conditions_acceptees BOOLEAN DEFAULT false,
  catalogue_debloque BOOLEAN DEFAULT false,
  solde_commission DECIMAL DEFAULT 0,
  total_commissions_gagnees DECIMAL DEFAULT 0,
  total_commissions_payees DECIMAL DEFAULT 0,
  taux_commission DECIMAL DEFAULT 10,
  kyc_document_recto_url TEXT,
  kyc_document_verso_url TEXT,
  kyc_selfie_url TEXT,
  kyc_type_document TEXT,
  kyc_raison_rejet TEXT,
  email_verification_code TEXT,
  email_verification_expires_at TIMESTAMPTZ,
  photo_profil_url TEXT,
  date_naissance DATE,
  experience_vente TEXT,
  motivation TEXT,
  role TEXT NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.sous_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  seller_id UUID REFERENCES public.sellers(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  nom_role TEXT,
  actif BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.admin_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sous_admin_id UUID REFERENCES public.sous_admins(id) ON DELETE CASCADE,
  sous_admin_email TEXT NOT NULL,
  modules_autorises JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  ordre INTEGER DEFAULT 0,
  actif BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.produits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL,
  reference TEXT UNIQUE,
  description TEXT,
  details TEXT,
  categorie_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  prix_achat DECIMAL DEFAULT 0,
  prix_gros DECIMAL DEFAULT 0,
  prix_vente DECIMAL NOT NULL DEFAULT 0,
  stock_global INTEGER DEFAULT 0,
  seuil_alerte_stock INTEGER DEFAULT 5,
  stocks_par_localisation JSONB DEFAULT '[]'::jsonb,
  variations JSONB DEFAULT '[]'::jsonb,
  images JSONB DEFAULT '[]'::jsonb,
  fournisseur TEXT,
  lien_telegram TEXT,
  actif BOOLEAN DEFAULT true,
  featured BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL,
  ville TEXT NOT NULL DEFAULT '',
  actif BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.livraisons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL,
  telephone TEXT,
  email TEXT,
  zones_couvertes JSONB DEFAULT '[]'::jsonb,
  tarif_par_zone JSONB DEFAULT '{}'::jsonb,
  actif BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.commandes_vendeur (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_commande TEXT UNIQUE,
  vendeur_id UUID REFERENCES public.sellers(id) ON DELETE SET NULL NOT NULL,
  vendeur_email TEXT NOT NULL,
  produit_id UUID REFERENCES public.produits(id) ON DELETE SET NULL,
  produit_nom TEXT NOT NULL,
  produit_reference TEXT,
  variation TEXT,
  quantite INTEGER DEFAULT 1,
  prix_unitaire DECIMAL NOT NULL DEFAULT 0,
  prix_final_client DECIMAL,
  montant_total DECIMAL NOT NULL DEFAULT 0,
  livraison_incluse BOOLEAN DEFAULT false,
  frais_livraison DECIMAL DEFAULT 0,
  client_nom TEXT NOT NULL,
  client_telephone TEXT NOT NULL,
  client_ville TEXT,
  client_quartier TEXT,
  client_adresse TEXT,
  statut TEXT DEFAULT 'en_attente_validation_admin',
  livreur_id UUID REFERENCES public.livraisons(id) ON DELETE SET NULL,
  notes TEXT,
  notes_admin TEXT,
  date_livraison_prevue TIMESTAMPTZ,
  date_livraison_effective TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.ventes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commande_id UUID REFERENCES public.commandes_vendeur(id) ON DELETE SET NULL,
  produit_id UUID REFERENCES public.produits(id) ON DELETE SET NULL NOT NULL,
  vendeur_id UUID REFERENCES public.sellers(id) ON DELETE SET NULL NOT NULL,
  vendeur_email TEXT NOT NULL,
  quantite INTEGER NOT NULL,
  montant_total DECIMAL NOT NULL,
  commission_vendeur DECIMAL NOT NULL DEFAULT 0,
  profit_zonite DECIMAL NOT NULL DEFAULT 0,
  prix_achat_unitaire DECIMAL,
  taux_commission_applique DECIMAL,
  mois INTEGER,
  annee INTEGER,
  semaine INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.retours_produit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commande_id UUID REFERENCES public.commandes_vendeur(id) ON DELETE SET NULL,
  vendeur_id UUID REFERENCES public.sellers(id) ON DELETE SET NULL NOT NULL,
  produit_id UUID REFERENCES public.produits(id) ON DELETE SET NULL NOT NULL,
  quantite INTEGER NOT NULL DEFAULT 1,
  raison TEXT,
  statut TEXT DEFAULT 'en_attente',
  impact_commission DECIMAL DEFAULT 0,
  notes_admin TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.mouvements_stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produit_id UUID REFERENCES public.produits(id) ON DELETE SET NULL NOT NULL,
  type TEXT NOT NULL,
  quantite INTEGER NOT NULL,
  stock_avant INTEGER,
  stock_apres INTEGER,
  reference_id UUID,
  localisation TEXT,
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.demandes_paiement_vendeur (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendeur_id UUID REFERENCES public.sellers(id) ON DELETE SET NULL NOT NULL,
  vendeur_email TEXT NOT NULL,
  montant DECIMAL NOT NULL,
  numero_mobile_money TEXT NOT NULL,
  operateur_mobile_money TEXT NOT NULL,
  statut TEXT DEFAULT 'en_attente',
  notes TEXT,
  notes_admin TEXT,
  traite_par TEXT,
  traite_at TIMESTAMPTZ,
  reference_paiement TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.paiements_commission (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  demande_id UUID REFERENCES public.demandes_paiement_vendeur(id) ON DELETE SET NULL,
  vendeur_id UUID REFERENCES public.sellers(id) ON DELETE SET NULL NOT NULL,
  montant DECIMAL NOT NULL,
  reference_paiement TEXT,
  methode_paiement TEXT,
  effectue_par TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.tickets_support (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendeur_id UUID REFERENCES public.sellers(id) ON DELETE SET NULL NOT NULL,
  vendeur_email TEXT NOT NULL,
  sujet TEXT NOT NULL,
  message TEXT NOT NULL,
  statut TEXT DEFAULT 'ouvert',
  priorite TEXT DEFAULT 'normale',
  categorie TEXT,
  reponse_admin TEXT,
  repondu_par TEXT,
  repondu_at TIMESTAMPTZ,
  lu_par_vendeur BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.faq_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question TEXT NOT NULL,
  reponse TEXT NOT NULL,
  categorie TEXT,
  ordre INTEGER DEFAULT 0,
  actif BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.notifications_vendeur (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendeur_id UUID REFERENCES public.sellers(id) ON DELETE CASCADE NOT NULL,
  vendeur_email TEXT NOT NULL,
  titre TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info',
  lu BOOLEAN DEFAULT false,
  action_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.notifications_admin (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titre TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info',
  lu BOOLEAN DEFAULT false,
  vendeur_email TEXT,
  reference_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.statistiques_journalieres (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE UNIQUE NOT NULL,
  total_commandes INTEGER DEFAULT 0,
  commandes_livrees INTEGER DEFAULT 0,
  commandes_annulees INTEGER DEFAULT 0,
  chiffre_affaires DECIMAL DEFAULT 0,
  total_commissions DECIMAL DEFAULT 0,
  profit_zonite DECIMAL DEFAULT 0,
  nouveaux_vendeurs INTEGER DEFAULT 0,
  vendeurs_actifs INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.journal_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  module TEXT NOT NULL DEFAULT '',
  details JSONB DEFAULT '{}'::jsonb,
  donnees_avant JSONB,
  donnees_apres JSONB,
  utilisateur TEXT,
  utilisateur_id UUID,
  entite_id UUID,
  entite_type TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.config_app (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cle TEXT UNIQUE NOT NULL,
  valeur JSONB NOT NULL DEFAULT '""'::jsonb,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.candidatures_vendeur (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  telephone TEXT,
  ville TEXT,
  statut TEXT DEFAULT 'en_attente',
  seller_id UUID REFERENCES public.sellers(id) ON DELETE SET NULL,
  notes_admin TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- SECURITY DEFINER FUNCTIONS
-- =============================================

CREATE OR REPLACE FUNCTION public.get_seller_role(_user_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.sellers WHERE user_id = _user_id LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_sous_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin', 'sous_admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.get_seller_id_for_user(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.sellers WHERE user_id = _user_id LIMIT 1;
$$;

-- =============================================
-- TRIGGER: Auto-update updated_at
-- =============================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_sellers_updated_at
  BEFORE UPDATE ON public.sellers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_produits_updated_at
  BEFORE UPDATE ON public.produits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_commandes_updated_at
  BEFORE UPDATE ON public.commandes_vendeur
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- RLS POLICIES
-- =============================================

ALTER TABLE public.sellers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sous_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.livraisons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commandes_vendeur ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ventes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retours_produit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mouvements_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demandes_paiement_vendeur ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paiements_commission ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets_support ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faq_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications_vendeur ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications_admin ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.statistiques_journalieres ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.config_app ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidatures_vendeur ENABLE ROW LEVEL SECURITY;

-- SELLERS
CREATE POLICY "Users view own seller" ON public.sellers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users update own seller" ON public.sellers FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Authenticated insert sellers" ON public.sellers FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Admins view all sellers" ON public.sellers FOR SELECT USING (public.is_admin_or_sous_admin(auth.uid()));
CREATE POLICY "Admins update sellers" ON public.sellers FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete sellers" ON public.sellers FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- USER_ROLES
CREATE POLICY "Admins manage user_roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users view own role" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);

-- SOUS_ADMINS
CREATE POLICY "Admins manage sous_admins" ON public.sous_admins FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Sous_admins view own" ON public.sous_admins FOR SELECT USING (user_id = auth.uid());

-- ADMIN_PERMISSIONS
CREATE POLICY "Admins manage permissions" ON public.admin_permissions FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- CATEGORIES
CREATE POLICY "Categories viewable" ON public.categories FOR SELECT USING (true);
CREATE POLICY "Admins manage categories" ON public.categories FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- PRODUITS
CREATE POLICY "Products viewable" ON public.produits FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage products" ON public.produits FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- ZONES
CREATE POLICY "Zones viewable" ON public.zones FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage zones" ON public.zones FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- LIVRAISONS
CREATE POLICY "Livraisons viewable" ON public.livraisons FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage livraisons" ON public.livraisons FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- COMMANDES_VENDEUR
CREATE POLICY "Sellers view own orders" ON public.commandes_vendeur FOR SELECT USING (vendeur_id = public.get_seller_id_for_user(auth.uid()));
CREATE POLICY "Sellers insert orders" ON public.commandes_vendeur FOR INSERT WITH CHECK (vendeur_id = public.get_seller_id_for_user(auth.uid()));
CREATE POLICY "Admins manage orders" ON public.commandes_vendeur FOR ALL USING (public.is_admin_or_sous_admin(auth.uid()));

-- VENTES
CREATE POLICY "Sellers view own ventes" ON public.ventes FOR SELECT USING (vendeur_id = public.get_seller_id_for_user(auth.uid()));
CREATE POLICY "Admins manage ventes" ON public.ventes FOR ALL USING (public.is_admin_or_sous_admin(auth.uid()));

-- RETOURS_PRODUIT
CREATE POLICY "Sellers view own retours" ON public.retours_produit FOR SELECT USING (vendeur_id = public.get_seller_id_for_user(auth.uid()));
CREATE POLICY "Admins manage retours" ON public.retours_produit FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- MOUVEMENTS_STOCK
CREATE POLICY "Admins manage stock" ON public.mouvements_stock FOR ALL USING (public.is_admin_or_sous_admin(auth.uid()));

-- DEMANDES_PAIEMENT_VENDEUR
CREATE POLICY "Sellers view own payments" ON public.demandes_paiement_vendeur FOR SELECT USING (vendeur_id = public.get_seller_id_for_user(auth.uid()));
CREATE POLICY "Sellers create payments" ON public.demandes_paiement_vendeur FOR INSERT WITH CHECK (vendeur_id = public.get_seller_id_for_user(auth.uid()));
CREATE POLICY "Admins manage payments" ON public.demandes_paiement_vendeur FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- PAIEMENTS_COMMISSION
CREATE POLICY "Sellers view own commissions" ON public.paiements_commission FOR SELECT USING (vendeur_id = public.get_seller_id_for_user(auth.uid()));
CREATE POLICY "Admins manage commissions" ON public.paiements_commission FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- TICKETS_SUPPORT
CREATE POLICY "Sellers view own tickets" ON public.tickets_support FOR SELECT USING (vendeur_id = public.get_seller_id_for_user(auth.uid()));
CREATE POLICY "Sellers create tickets" ON public.tickets_support FOR INSERT WITH CHECK (vendeur_id = public.get_seller_id_for_user(auth.uid()));
CREATE POLICY "Admins manage tickets" ON public.tickets_support FOR ALL USING (public.is_admin_or_sous_admin(auth.uid()));

-- FAQ_ITEMS
CREATE POLICY "FAQ viewable" ON public.faq_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage FAQ" ON public.faq_items FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- NOTIFICATIONS_VENDEUR
CREATE POLICY "Sellers view own notifs" ON public.notifications_vendeur FOR SELECT USING (vendeur_id = public.get_seller_id_for_user(auth.uid()));
CREATE POLICY "Sellers update own notifs" ON public.notifications_vendeur FOR UPDATE USING (vendeur_id = public.get_seller_id_for_user(auth.uid()));
CREATE POLICY "Admins manage notifs" ON public.notifications_vendeur FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- NOTIFICATIONS_ADMIN
CREATE POLICY "Admins manage admin_notifs" ON public.notifications_admin FOR ALL USING (public.is_admin_or_sous_admin(auth.uid()));

-- STATISTIQUES
CREATE POLICY "Admins view stats" ON public.statistiques_journalieres FOR ALL USING (public.is_admin_or_sous_admin(auth.uid()));

-- JOURNAL_AUDIT
CREATE POLICY "Admins view audit" ON public.journal_audit FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Authenticated insert audit" ON public.journal_audit FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- CONFIG_APP
CREATE POLICY "Config viewable" ON public.config_app FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage config" ON public.config_app FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- CANDIDATURES
CREATE POLICY "Admins manage candidatures" ON public.candidatures_vendeur FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- DEFAULT CONFIG DATA
-- =============================================

INSERT INTO public.config_app (cle, valeur, description) VALUES
  ('taux_commission_defaut', '10', 'Taux commission par défaut en %'),
  ('delai_livraison_defaut', '48', 'Délai livraison en heures'),
  ('montant_minimum_paiement', '5000', 'Montant minimum retrait en FCFA'),
  ('app_name', '"ZONITE"', 'Nom application'),
  ('app_version', '"1.0.0"', 'Version'),
  ('maintenance_mode', 'false', 'Mode maintenance'),
  ('nom_app', '"ZONITE Vendeurs"', 'Nom affiché'),
  ('message_accueil', '"Chaque vente est une victoire ! 🚀"', 'Message accueil'),
  ('lien_facebook', '"https://facebook.com"', 'Lien Facebook'),
  ('lien_tiktok', '"https://tiktok.com"', 'Lien TikTok');

-- =============================================
-- REALTIME
-- =============================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications_vendeur;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications_admin;
ALTER PUBLICATION supabase_realtime ADD TABLE public.commandes_vendeur;
