
-- Add stock tracking columns to commandes_vendeur
ALTER TABLE commandes_vendeur ADD COLUMN IF NOT EXISTS stock_reserve BOOLEAN DEFAULT false;
ALTER TABLE commandes_vendeur ADD COLUMN IF NOT EXISTS stock_retire_definitif BOOLEAN DEFAULT false;

-- Add detailed tracking columns to mouvements_stock
ALTER TABLE mouvements_stock ADD COLUMN IF NOT EXISTS commande_id UUID;
ALTER TABLE mouvements_stock ADD COLUMN IF NOT EXISTS coursier_id UUID;
ALTER TABLE mouvements_stock ADD COLUMN IF NOT EXISTS variation_key TEXT;
