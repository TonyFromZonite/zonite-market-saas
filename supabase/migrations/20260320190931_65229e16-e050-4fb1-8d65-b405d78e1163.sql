
-- Performance indexes for frequently queried columns
CREATE INDEX IF NOT EXISTS idx_sellers_user_id ON public.sellers(user_id);
CREATE INDEX IF NOT EXISTS idx_sellers_email ON public.sellers(email);
CREATE INDEX IF NOT EXISTS idx_sellers_status ON public.sellers(seller_status);
CREATE INDEX IF NOT EXISTS idx_commandes_vendeur_id ON public.commandes_vendeur(vendeur_id);
CREATE INDEX IF NOT EXISTS idx_commandes_statut ON public.commandes_vendeur(statut);
CREATE INDEX IF NOT EXISTS idx_commandes_created ON public.commandes_vendeur(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifs_vendeur_id ON public.notifications_vendeur(vendeur_id);
CREATE INDEX IF NOT EXISTS idx_notifs_vendeur_lu ON public.notifications_vendeur(vendeur_id, lu);
CREATE INDEX IF NOT EXISTS idx_ventes_vendeur_id ON public.ventes(vendeur_id);
CREATE INDEX IF NOT EXISTS idx_ventes_created ON public.ventes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_produits_actif ON public.produits(actif);
CREATE INDEX IF NOT EXISTS idx_produits_categorie ON public.produits(categorie_id);
CREATE INDEX IF NOT EXISTS idx_paiements_vendeur ON public.demandes_paiement_vendeur(vendeur_id);
CREATE INDEX IF NOT EXISTS idx_paiements_statut ON public.demandes_paiement_vendeur(statut);
CREATE INDEX IF NOT EXISTS idx_notifs_admin_lu ON public.notifications_admin(lu);
CREATE INDEX IF NOT EXISTS idx_tickets_vendeur_id ON public.tickets_support(vendeur_id);
