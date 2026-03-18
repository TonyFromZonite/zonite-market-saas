
ALTER TABLE public.ventes ADD COLUMN IF NOT EXISTS prix_final_client DECIMAL DEFAULT 0;
ALTER TABLE public.ventes ADD COLUMN IF NOT EXISTS prix_gros DECIMAL DEFAULT 0;
ALTER TABLE public.ventes ADD COLUMN IF NOT EXISTS prix_achat DECIMAL DEFAULT 0;
ALTER TABLE public.ventes ADD COLUMN IF NOT EXISTS marge_zonite DECIMAL DEFAULT 0;
ALTER TABLE public.ventes DROP COLUMN IF EXISTS taux_commission_applique;
ALTER TABLE public.sellers DROP COLUMN IF EXISTS taux_commission;
