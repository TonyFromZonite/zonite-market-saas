
-- =========================================================
-- 1) PRODUITS : retirer la lecture directe par les vendeurs.
--    Les vendeurs doivent passer par la vue produits_public
--    qui n'expose pas prix_achat.
-- =========================================================
DROP POLICY IF EXISTS "Sellers read active products" ON public.produits;

-- =========================================================
-- 2) VENTES : retirer la lecture directe par les vendeurs.
--    Les vendeurs doivent passer par la vue ventes_vendeur_safe
--    qui exclut prix_achat, prix_achat_unitaire, prix_gros,
--    profit_zonite, marge_zonite.
-- =========================================================
DROP POLICY IF EXISTS "Sellers read own ventes" ON public.ventes;

-- =========================================================
-- 3) SELLERS : verrou RLS indépendant du trigger.
--    Helper qui interdit toute modification de colonnes
--    privilégiées par le vendeur lui-même (admin non concerné :
--    la policy "Admins update sellers" reste sans restriction).
-- =========================================================
CREATE OR REPLACE FUNCTION public.seller_self_update_only_safe(
  _id uuid,
  _new public.sellers
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.sellers s
    WHERE s.id = _id
      AND s.role IS NOT DISTINCT FROM _new.role
      AND s.user_id IS NOT DISTINCT FROM _new.user_id
      AND s.email IS NOT DISTINCT FROM _new.email
      AND s.solde_commission IS NOT DISTINCT FROM _new.solde_commission
      AND s.solde_en_attente IS NOT DISTINCT FROM _new.solde_en_attente
      AND s.total_commissions_gagnees IS NOT DISTINCT FROM _new.total_commissions_gagnees
      AND s.total_commissions_payees IS NOT DISTINCT FROM _new.total_commissions_payees
      AND s.email_verified IS NOT DISTINCT FROM _new.email_verified
      AND s.email_verification_code IS NOT DISTINCT FROM _new.email_verification_code
      AND s.email_verification_expires_at IS NOT DISTINCT FROM _new.email_verification_expires_at
      AND s.catalogue_debloque IS NOT DISTINCT FROM _new.catalogue_debloque
      AND s.training_completed IS NOT DISTINCT FROM _new.training_completed
      AND s.conditions_acceptees IS NOT DISTINCT FROM _new.conditions_acceptees
      AND s.parraine_par IS NOT DISTINCT FROM _new.parraine_par
      AND (
        s.statut_kyc IS NOT DISTINCT FROM _new.statut_kyc
        OR (
          _new.statut_kyc = 'en_attente'
          AND COALESCE(s.statut_kyc, 'non_soumis') IN ('non_soumis','rejete','en_attente')
        )
      )
      AND (
        s.seller_status IS NOT DISTINCT FROM _new.seller_status
        OR (_new.seller_status = 'kyc_pending' AND _new.statut_kyc = 'en_attente')
      )
  );
$$;

REVOKE ALL ON FUNCTION public.seller_self_update_only_safe(uuid, public.sellers) FROM public;
GRANT EXECUTE ON FUNCTION public.seller_self_update_only_safe(uuid, public.sellers) TO authenticated, service_role;

DROP POLICY IF EXISTS "Users update own seller" ON public.sellers;

CREATE POLICY "Users update own seller safe cols"
ON public.sellers
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND public.seller_self_update_only_safe(sellers.id, sellers.*::public.sellers)
);

-- =========================================================
-- 4) GRANTs : s'assurer que les vues restent lisibles.
-- =========================================================
GRANT SELECT ON public.produits_public TO authenticated, anon;
GRANT SELECT ON public.ventes_vendeur_safe TO authenticated;
