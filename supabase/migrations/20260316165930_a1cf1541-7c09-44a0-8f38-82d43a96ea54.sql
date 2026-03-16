
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TABLE public.sellers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  nom_complet TEXT NOT NULL,
  telephone TEXT,
  ville TEXT,
  quartier TEXT,
  numero_mobile_money TEXT,
  operateur_mobile_money TEXT DEFAULT 'orange_money',
  experience_vente TEXT,
  photo_identite_url TEXT,
  photo_identite_verso_url TEXT,
  selfie_url TEXT,
  seller_status TEXT NOT NULL DEFAULT 'pending_verification',
  training_completed BOOLEAN DEFAULT false,
  catalogue_debloque BOOLEAN DEFAULT false,
  role TEXT NOT NULL DEFAULT 'user',
  solde_commission NUMERIC DEFAULT 0,
  total_ventes NUMERIC DEFAULT 0,
  nombre_commandes INTEGER DEFAULT 0,
  verification_code TEXT,
  verification_code_expires_at TIMESTAMPTZ,
  password_hash TEXT,
  statut_kyc TEXT DEFAULT 'non_soumis',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.sellers ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.sellers WHERE user_id = _user_id AND role = _role) $$;

CREATE OR REPLACE FUNCTION public.get_seller_role(_user_id UUID)
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT role FROM public.sellers WHERE user_id = _user_id LIMIT 1 $$;

CREATE POLICY "Users can view own seller" ON public.sellers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all sellers" ON public.sellers FOR SELECT USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'sous_admin'));
CREATE POLICY "Users can update own seller" ON public.sellers FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can update all sellers" ON public.sellers FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Anyone can insert sellers" ON public.sellers FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can delete sellers" ON public.sellers FOR DELETE USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER update_sellers_updated_at BEFORE UPDATE ON public.sellers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nom TEXT NOT NULL, description TEXT, image_url TEXT, active BOOLEAN DEFAULT true, ordre INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Categories viewable by all" ON public.categories FOR SELECT USING (true);
CREATE POLICY "Admins manage categories" ON public.categories FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.produits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  seller_id UUID REFERENCES public.sellers(id) ON DELETE SET NULL,
  nom TEXT NOT NULL, description TEXT, prix NUMERIC NOT NULL DEFAULT 0, prix_achat NUMERIC DEFAULT 0,
  stock INTEGER NOT NULL DEFAULT 0, stock_minimum INTEGER DEFAULT 5,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  image_url TEXT, images TEXT[], actif BOOLEAN DEFAULT true, sku TEXT, poids NUMERIC, unite TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.produits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Products viewable by authenticated" ON public.produits FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage products" ON public.produits FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER update_produits_updated_at BEFORE UPDATE ON public.produits FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.commandes_vendeur (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vendeur_id UUID REFERENCES public.sellers(id) ON DELETE SET NULL,
  client_nom TEXT, client_telephone TEXT, client_adresse TEXT,
  produits JSONB DEFAULT '[]', total NUMERIC DEFAULT 0, commission NUMERIC DEFAULT 0,
  statut TEXT DEFAULT 'en_attente_validation_admin', notes TEXT, zone_livraison TEXT,
  coursier_id UUID, date_livraison TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.commandes_vendeur ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sellers view own orders" ON public.commandes_vendeur FOR SELECT USING (vendeur_id IN (SELECT id FROM public.sellers WHERE user_id = auth.uid()));
CREATE POLICY "Admins manage orders" ON public.commandes_vendeur FOR ALL USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'sous_admin'));
CREATE POLICY "Sellers insert orders" ON public.commandes_vendeur FOR INSERT WITH CHECK (vendeur_id IN (SELECT id FROM public.sellers WHERE user_id = auth.uid()));
CREATE TRIGGER update_commandes_vendeur_updated_at BEFORE UPDATE ON public.commandes_vendeur FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.ventes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_nom TEXT, client_telephone TEXT, client_adresse TEXT,
  produits JSONB DEFAULT '[]', total NUMERIC DEFAULT 0, statut TEXT DEFAULT 'en_attente',
  mode_paiement TEXT, notes TEXT, zone_livraison TEXT, coursier_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ventes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage ventes" ON public.ventes FOR ALL USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'sous_admin'));
CREATE TRIGGER update_ventes_updated_at BEFORE UPDATE ON public.ventes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.mouvements_stock (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  produit_id UUID REFERENCES public.produits(id) ON DELETE CASCADE,
  type TEXT NOT NULL, quantite INTEGER NOT NULL, motif TEXT, reference_id UUID,
  created_by UUID REFERENCES public.sellers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.mouvements_stock ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage stock" ON public.mouvements_stock FOR ALL USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'sous_admin'));

CREATE TABLE public.demandes_paiement_vendeur (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vendeur_id UUID REFERENCES public.sellers(id) ON DELETE CASCADE,
  montant NUMERIC NOT NULL, mode_paiement TEXT DEFAULT 'mobile_money', numero_paiement TEXT,
  statut TEXT DEFAULT 'en_attente', notes TEXT, traite_par UUID REFERENCES public.sellers(id),
  date_traitement TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.demandes_paiement_vendeur ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sellers view own payments" ON public.demandes_paiement_vendeur FOR SELECT USING (vendeur_id IN (SELECT id FROM public.sellers WHERE user_id = auth.uid()));
CREATE POLICY "Sellers create payments" ON public.demandes_paiement_vendeur FOR INSERT WITH CHECK (vendeur_id IN (SELECT id FROM public.sellers WHERE user_id = auth.uid()));
CREATE POLICY "Admins manage payments" ON public.demandes_paiement_vendeur FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER update_demandes_paiement_updated_at BEFORE UPDATE ON public.demandes_paiement_vendeur FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.paiements_commission (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vendeur_id UUID REFERENCES public.sellers(id) ON DELETE CASCADE,
  montant NUMERIC NOT NULL, periode TEXT, statut TEXT DEFAULT 'en_attente', notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.paiements_commission ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sellers view commissions" ON public.paiements_commission FOR SELECT USING (vendeur_id IN (SELECT id FROM public.sellers WHERE user_id = auth.uid()));
CREATE POLICY "Admins manage commissions" ON public.paiements_commission FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.retours_produit (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  commande_id UUID, produit_id UUID REFERENCES public.produits(id),
  vendeur_id UUID REFERENCES public.sellers(id), motif TEXT, statut TEXT DEFAULT 'en_attente',
  quantite INTEGER DEFAULT 1, notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.retours_produit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage returns" ON public.retours_produit FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER update_retours_updated_at BEFORE UPDATE ON public.retours_produit FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.tickets_support (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vendeur_id UUID REFERENCES public.sellers(id) ON DELETE CASCADE,
  sujet TEXT NOT NULL, message TEXT NOT NULL, statut TEXT DEFAULT 'ouvert',
  priorite TEXT DEFAULT 'normale', reponse TEXT, lu BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tickets_support ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sellers view own tickets" ON public.tickets_support FOR SELECT USING (vendeur_id IN (SELECT id FROM public.sellers WHERE user_id = auth.uid()));
CREATE POLICY "Sellers create tickets" ON public.tickets_support FOR INSERT WITH CHECK (vendeur_id IN (SELECT id FROM public.sellers WHERE user_id = auth.uid()));
CREATE POLICY "Admins manage tickets" ON public.tickets_support FOR ALL USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'sous_admin'));
CREATE TRIGGER update_tickets_updated_at BEFORE UPDATE ON public.tickets_support FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.notifications_vendeur (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vendeur_id UUID REFERENCES public.sellers(id) ON DELETE CASCADE,
  titre TEXT NOT NULL, message TEXT NOT NULL, type TEXT DEFAULT 'info', lu BOOLEAN DEFAULT false, lien TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications_vendeur ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sellers view notifications" ON public.notifications_vendeur FOR SELECT USING (vendeur_id IN (SELECT id FROM public.sellers WHERE user_id = auth.uid()));
CREATE POLICY "Sellers update notifications" ON public.notifications_vendeur FOR UPDATE USING (vendeur_id IN (SELECT id FROM public.sellers WHERE user_id = auth.uid()));
CREATE POLICY "Admins manage notifications" ON public.notifications_vendeur FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.journal_audit (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  action TEXT NOT NULL, entite TEXT, entite_id UUID,
  utilisateur_id UUID REFERENCES public.sellers(id), utilisateur_email TEXT,
  details JSONB, ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.journal_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view audit" ON public.journal_audit FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Anyone insert audit" ON public.journal_audit FOR INSERT WITH CHECK (true);

CREATE TABLE public.candidatures_vendeur (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  seller_id UUID REFERENCES public.sellers(id) ON DELETE CASCADE,
  statut TEXT DEFAULT 'en_attente', notes_admin TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.candidatures_vendeur ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage candidatures" ON public.candidatures_vendeur FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.sous_admins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  seller_id UUID REFERENCES public.sellers(id) ON DELETE CASCADE UNIQUE,
  nom_complet TEXT, email TEXT, permissions TEXT[] DEFAULT '{}', actif BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.sous_admins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage sous_admins" ON public.sous_admins FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Sous_admins view own" ON public.sous_admins FOR SELECT USING (seller_id IN (SELECT id FROM public.sellers WHERE user_id = auth.uid()));
CREATE TRIGGER update_sous_admins_updated_at BEFORE UPDATE ON public.sous_admins FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.admin_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.sellers(id) ON DELETE CASCADE,
  module_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage permissions" ON public.admin_permissions FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.faq_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  question TEXT NOT NULL, reponse TEXT NOT NULL, categorie TEXT, ordre INTEGER DEFAULT 0, actif BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.faq_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "FAQ viewable" ON public.faq_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage FAQ" ON public.faq_items FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.zones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nom TEXT NOT NULL, description TEXT, frais_livraison NUMERIC DEFAULT 0, actif BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.zones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Zones viewable" ON public.zones FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage zones" ON public.zones FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.livraisons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  commande_id UUID, commande_type TEXT DEFAULT 'vendeur',
  zone_id UUID REFERENCES public.zones(id), coursier_nom TEXT, coursier_telephone TEXT,
  statut TEXT DEFAULT 'en_attente', adresse_livraison TEXT, notes TEXT,
  date_prevue TIMESTAMPTZ, date_livraison TIMESTAMPTZ, frais NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.livraisons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage livraisons" ON public.livraisons FOR ALL USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'sous_admin'));
CREATE TRIGGER update_livraisons_updated_at BEFORE UPDATE ON public.livraisons FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.config_app (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cle TEXT NOT NULL UNIQUE, valeur TEXT, description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.config_app ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Config viewable" ON public.config_app FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage config" ON public.config_app FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER update_config_app_updated_at BEFORE UPDATE ON public.config_app FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.coursiers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nom TEXT NOT NULL, telephone TEXT, zone_id UUID REFERENCES public.zones(id),
  actif BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.coursiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage coursiers" ON public.coursiers FOR ALL USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'sous_admin'));
CREATE TRIGGER update_coursiers_updated_at BEFORE UPDATE ON public.coursiers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_sellers_email ON public.sellers(email);
CREATE INDEX idx_sellers_user_id ON public.sellers(user_id);
CREATE INDEX idx_sellers_role ON public.sellers(role);
CREATE INDEX idx_sellers_status ON public.sellers(seller_status);
CREATE INDEX idx_produits_seller ON public.produits(seller_id);
CREATE INDEX idx_produits_category ON public.produits(category_id);
CREATE INDEX idx_commandes_vendeur_id ON public.commandes_vendeur(vendeur_id);
CREATE INDEX idx_commandes_statut ON public.commandes_vendeur(statut);
CREATE INDEX idx_notifications_vendeur ON public.notifications_vendeur(vendeur_id);
CREATE INDEX idx_tickets_vendeur ON public.tickets_support(vendeur_id);
CREATE INDEX idx_journal_audit_created ON public.journal_audit(created_at DESC);

INSERT INTO storage.buckets (id, name, public) VALUES ('kyc-documents', 'kyc-documents', false);
CREATE POLICY "Users upload KYC docs" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'kyc-documents' AND auth.uid() IS NOT NULL);
CREATE POLICY "Users view KYC docs" ON storage.objects FOR SELECT USING (bucket_id = 'kyc-documents' AND auth.uid() IS NOT NULL);

INSERT INTO public.config_app (cle, valeur, description) VALUES
  ('nom_app', 'ZONITE Vendeurs', 'Nom de application'),
  ('message_accueil', 'Bienvenue sur ZONITE Market', 'Message accueil'),
  ('lien_facebook', 'https://facebook.com/zonite', 'Lien Facebook'),
  ('lien_tiktok', 'https://tiktok.com/@zonite', 'Lien TikTok'),
  ('commission_rate', '10', 'Taux de commission en pourcent'),
  ('video_formation_url', '', 'URL de la video de formation');
