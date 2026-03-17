
-- Sellers indexes
CREATE INDEX IF NOT EXISTS idx_sellers_user_id ON sellers(user_id);
CREATE INDEX IF NOT EXISTS idx_sellers_email ON sellers(email);
CREATE INDEX IF NOT EXISTS idx_sellers_status ON sellers(seller_status);
CREATE INDEX IF NOT EXISTS idx_sellers_kyc ON sellers(statut_kyc);
CREATE INDEX IF NOT EXISTS idx_sellers_username ON sellers(username);

-- Orders indexes
CREATE INDEX IF NOT EXISTS idx_commandes_vendeur_id ON commandes_vendeur(vendeur_id);
CREATE INDEX IF NOT EXISTS idx_commandes_statut ON commandes_vendeur(statut);
CREATE INDEX IF NOT EXISTS idx_commandes_created ON commandes_vendeur(created_at DESC);

-- Notifications indexes
CREATE INDEX IF NOT EXISTS idx_notifs_vendeur_id ON notifications_vendeur(vendeur_id);
CREATE INDEX IF NOT EXISTS idx_notifs_lu ON notifications_vendeur(lu);
CREATE INDEX IF NOT EXISTS idx_notifs_admin_lu ON notifications_admin(lu);

-- Ventes indexes
CREATE INDEX IF NOT EXISTS idx_ventes_vendeur_id ON ventes(vendeur_id);
CREATE INDEX IF NOT EXISTS idx_ventes_created ON ventes(created_at DESC);

-- Products indexes
CREATE INDEX IF NOT EXISTS idx_produits_actif ON produits(actif);
CREATE INDEX IF NOT EXISTS idx_produits_categorie ON produits(categorie_id);

-- Tickets indexes
CREATE INDEX IF NOT EXISTS idx_tickets_vendeur_id ON tickets_support(vendeur_id);
CREATE INDEX IF NOT EXISTS idx_tickets_statut ON tickets_support(statut);

-- User roles index
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);

-- Zones and quartiers
CREATE INDEX IF NOT EXISTS idx_quartiers_ville_id ON quartiers(ville_id);
CREATE INDEX IF NOT EXISTS idx_zones_livraison_ville_id ON zones_livraison(ville_id);
CREATE INDEX IF NOT EXISTS idx_coursiers_ville_id ON coursiers(ville_id);
