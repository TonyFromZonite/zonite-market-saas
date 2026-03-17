
-- Add coursier_id column to commandes_vendeur
ALTER TABLE public.commandes_vendeur ADD COLUMN IF NOT EXISTS coursier_id UUID REFERENCES public.coursiers(id);
ALTER TABLE public.commandes_vendeur ADD COLUMN IF NOT EXISTS coursier_nom TEXT;
ALTER TABLE public.commandes_vendeur ADD COLUMN IF NOT EXISTS date_livraison_estimee TEXT;
