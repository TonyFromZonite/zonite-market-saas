
-- notifications_vendeur : restrict INSERT to own vendor or admin
DROP POLICY IF EXISTS "Authenticated insert vendor notifs" ON public.notifications_vendeur;
CREATE POLICY "Insert own or admin vendor notifs"
ON public.notifications_vendeur
FOR INSERT
TO authenticated
WITH CHECK (
  vendeur_id = public.get_seller_id_for_user(auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);

-- notifications_admin : admins only (service_role bypasses RLS)
DROP POLICY IF EXISTS "Authenticated insert admin notifs" ON public.notifications_admin;
CREATE POLICY "Admins insert admin notifs"
ON public.notifications_admin
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- journal_audit : admins only (service_role bypasses RLS)
DROP POLICY IF EXISTS "Authenticated insert audit" ON public.journal_audit;
CREATE POLICY "Admins insert audit"
ON public.journal_audit
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));
