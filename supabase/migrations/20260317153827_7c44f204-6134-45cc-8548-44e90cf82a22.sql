
-- =====================================================
-- PART 1: New logistics tables for ZONITE Cameroon
-- =====================================================

-- Table: villes_cameroun
CREATE TABLE public.villes_cameroun (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT UNIQUE NOT NULL,
  region TEXT,
  actif BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.villes_cameroun ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage villes" ON public.villes_cameroun
  FOR ALL TO authenticated
  USING (public.is_admin_or_sous_admin(auth.uid()));

CREATE POLICY "Villes viewable by authenticated" ON public.villes_cameroun
  FOR SELECT TO authenticated
  USING (true);

-- Seed default Cameroon cities
INSERT INTO public.villes_cameroun (nom, region) VALUES
  ('Yaoundé', 'Centre'),
  ('Douala', 'Littoral'),
  ('Bafoussam', 'Ouest'),
  ('Bamenda', 'Nord-Ouest'),
  ('Garoua', 'Nord'),
  ('Maroua', 'Extrême-Nord'),
  ('Ngaoundéré', 'Adamaoua'),
  ('Bertoua', 'Est'),
  ('Ebolowa', 'Sud'),
  ('Kribi', 'Sud'),
  ('Buea', 'Sud-Ouest'),
  ('Limbe', 'Sud-Ouest');

-- Table: quartiers
CREATE TABLE public.quartiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL,
  ville_id UUID NOT NULL REFERENCES public.villes_cameroun(id) ON DELETE CASCADE,
  actif BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.quartiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage quartiers" ON public.quartiers
  FOR ALL TO authenticated
  USING (public.is_admin_or_sous_admin(auth.uid()));

CREATE POLICY "Quartiers viewable by authenticated" ON public.quartiers
  FOR SELECT TO authenticated
  USING (true);

-- Table: zones_livraison
CREATE TABLE public.zones_livraison (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL,
  ville_id UUID NOT NULL REFERENCES public.villes_cameroun(id) ON DELETE CASCADE,
  quartiers_ids JSONB DEFAULT '[]',
  actif BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.zones_livraison ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage zones_livraison" ON public.zones_livraison
  FOR ALL TO authenticated
  USING (public.is_admin_or_sous_admin(auth.uid()));

CREATE POLICY "Zones viewable by authenticated" ON public.zones_livraison
  FOR SELECT TO authenticated
  USING (true);

-- Table: coursiers
CREATE TABLE public.coursiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL,
  telephone TEXT,
  email TEXT,
  ville_id UUID REFERENCES public.villes_cameroun(id),
  adresse_entrepot TEXT,
  zones_livraison_ids JSONB DEFAULT '[]',
  actif BOOLEAN DEFAULT true,
  frais_livraison_defaut DECIMAL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.coursiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage coursiers" ON public.coursiers
  FOR ALL TO authenticated
  USING (public.is_admin_or_sous_admin(auth.uid()));

CREATE POLICY "Coursiers viewable by authenticated" ON public.coursiers
  FOR SELECT TO authenticated
  USING (true);

-- =====================================================
-- PART 2: Add stocks_par_coursier to produits
-- =====================================================
ALTER TABLE public.produits ADD COLUMN IF NOT EXISTS stocks_par_coursier JSONB DEFAULT '[]';
