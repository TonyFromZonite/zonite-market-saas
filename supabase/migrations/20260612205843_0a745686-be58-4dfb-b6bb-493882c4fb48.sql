
CREATE OR REPLACE VIEW public.ventes_vendeur_safe
WITH (security_invoker = false) AS
SELECT
  v.id,
  v.commande_id,
  v.produit_id,
  v.vendeur_id,
  v.vendeur_email,
  v.quantite,
  v.montant_total,
  v.commission_vendeur,
  v.prix_final_client,
  v.mois,
  v.annee,
  v.semaine,
  v.created_at
FROM public.ventes v
WHERE v.vendeur_id = public.get_seller_id_for_user(auth.uid());

GRANT SELECT ON public.ventes_vendeur_safe TO authenticated;
