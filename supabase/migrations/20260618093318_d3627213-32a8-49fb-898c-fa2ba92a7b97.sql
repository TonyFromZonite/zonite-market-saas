
-- 1) Drop privilege-escalation self-insert on user_roles
DROP POLICY IF EXISTS "Users insert own role" ON public.user_roles;

-- 2) Drop direct sellers SELECT on ventes (force use of ventes_vendeur_safe view)
DROP POLICY IF EXISTS "Sellers view own ventes" ON public.ventes;

-- 3) Tighten journal_audit INSERT: caller can only insert rows attributed to themselves
DROP POLICY IF EXISTS "Authenticated insert audit" ON public.journal_audit;
CREATE POLICY "Authenticated insert audit"
ON public.journal_audit
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (utilisateur_id IS NULL OR utilisateur_id = auth.uid())
);

-- 4) Tighten notifications_vendeur INSERT
DROP POLICY IF EXISTS "Authenticated insert vendor notifs" ON public.notifications_vendeur;
CREATE POLICY "Authenticated insert vendor notifs"
ON public.notifications_vendeur
FOR INSERT
TO authenticated
WITH CHECK (
  vendeur_id = public.get_seller_id_for_user(auth.uid())
  OR public.is_admin_or_sous_admin(auth.uid())
);

-- 5) Tighten notifications_admin INSERT: only sellers or admins (no random auth users)
DROP POLICY IF EXISTS "Authenticated insert admin notifs" ON public.notifications_admin;
CREATE POLICY "Authenticated insert admin notifs"
ON public.notifications_admin
FOR INSERT
TO authenticated
WITH CHECK (
  public.get_seller_id_for_user(auth.uid()) IS NOT NULL
  OR public.is_admin_or_sous_admin(auth.uid())
);
