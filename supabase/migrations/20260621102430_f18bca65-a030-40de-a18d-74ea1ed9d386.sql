-- Restrict realtime broadcasts on commandes_vendeur to exclude customer PII
-- (client_nom, client_telephone, client_adresse, client_ville, client_quartier).
-- Subscribers still receive change events for invalidation; full row fetch
-- goes through RLS-protected SELECT.
ALTER PUBLICATION supabase_realtime DROP TABLE public.commandes_vendeur;
ALTER PUBLICATION supabase_realtime ADD TABLE public.commandes_vendeur
  (id, reference_commande, vendeur_id, vendeur_email, produit_id, produit_nom,
   produit_reference, variation, quantite, prix_unitaire, prix_final_client,
   montant_total, livraison_incluse, frais_livraison, statut, livreur_id,
   notes_admin, date_livraison_prevue, date_livraison_effective, created_at,
   updated_at, coursier_id, coursier_nom, date_livraison_estimee,
   stock_reserve, stock_retire_definitif);