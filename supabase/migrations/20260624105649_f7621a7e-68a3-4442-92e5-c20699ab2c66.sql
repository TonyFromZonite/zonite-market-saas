
-- Sellers can browse active products (cost columns are protected by column-level REVOKE separately)
CREATE POLICY "Sellers read active products"
ON public.produits
FOR SELECT
TO authenticated
USING (actif = true AND public.get_seller_id_for_user(auth.uid()) IS NOT NULL);

-- Sellers can read their own sales records
CREATE POLICY "Sellers read own ventes"
ON public.ventes
FOR SELECT
TO authenticated
USING (vendeur_id = public.get_seller_id_for_user(auth.uid()));

-- Hide email verification code from clients (it is a secret sent via email).
-- Only service_role (edge functions) needs to read/write it.
REVOKE SELECT (email_verification_code, email_verification_expires_at) ON public.sellers FROM authenticated;
REVOKE SELECT (email_verification_code, email_verification_expires_at) ON public.sellers FROM anon;
