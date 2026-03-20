
-- Referral system table
CREATE TABLE IF NOT EXISTS public.parrainages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parrain_id UUID NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
  filleul_id UUID NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
  code_parrainage TEXT NOT NULL,
  livraisons_comptees INTEGER DEFAULT 0,
  commission_totale NUMERIC DEFAULT 0,
  actif BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(parrain_id, filleul_id)
);

ALTER TABLE public.parrainages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sellers_view_own_parrainages" ON public.parrainages FOR SELECT USING (
  parrain_id = public.get_seller_id_for_user(auth.uid()) OR filleul_id = public.get_seller_id_for_user(auth.uid())
);
CREATE POLICY "admins_manage_parrainages" ON public.parrainages FOR ALL USING (public.is_admin_or_sous_admin(auth.uid()));
CREATE POLICY "sellers_insert_parrainages" ON public.parrainages FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Add referral code to sellers
ALTER TABLE public.sellers ADD COLUMN IF NOT EXISTS code_parrainage TEXT;
ALTER TABLE public.sellers ADD COLUMN IF NOT EXISTS parraine_par TEXT;
ALTER TABLE public.sellers ADD COLUMN IF NOT EXISTS badge_niveau TEXT DEFAULT 'nouveau';
ALTER TABLE public.sellers ADD COLUMN IF NOT EXISTS objectif_mensuel INTEGER DEFAULT 10;

-- Badges history
CREATE TABLE IF NOT EXISTS public.badges_vendeur (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendeur_id UUID NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
  badge TEXT NOT NULL,
  obtenu_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.badges_vendeur ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sellers_view_own_badges" ON public.badges_vendeur FOR SELECT USING (
  vendeur_id = public.get_seller_id_for_user(auth.uid())
);
CREATE POLICY "admins_manage_badges" ON public.badges_vendeur FOR ALL USING (public.is_admin_or_sous_admin(auth.uid()));
CREATE POLICY "system_insert_badges" ON public.badges_vendeur FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
