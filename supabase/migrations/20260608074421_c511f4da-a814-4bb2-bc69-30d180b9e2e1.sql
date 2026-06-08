
DROP POLICY IF EXISTS "Insert own or admin vendor notifs" ON public.notifications_vendeur;
CREATE POLICY "Authenticated insert vendor notifs"
ON public.notifications_vendeur
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Admins insert admin notifs" ON public.notifications_admin;
CREATE POLICY "Authenticated insert admin notifs"
ON public.notifications_admin
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Admins insert audit" ON public.journal_audit;
CREATE POLICY "Authenticated insert audit"
ON public.journal_audit
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);
