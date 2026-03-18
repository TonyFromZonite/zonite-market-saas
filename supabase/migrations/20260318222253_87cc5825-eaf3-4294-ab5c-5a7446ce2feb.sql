
ALTER TABLE public.sellers ADD COLUMN IF NOT EXISTS solde_en_attente DECIMAL DEFAULT 0;
ALTER TABLE public.demandes_paiement_vendeur ADD COLUMN IF NOT EXISTS motif_rejet TEXT;
