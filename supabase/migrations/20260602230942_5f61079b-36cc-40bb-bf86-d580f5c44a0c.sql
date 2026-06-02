-- 1. Privilege escalation fix on user_roles
DROP POLICY IF EXISTS "Users insert own role" ON public.user_roles;
CREATE POLICY "Users insert own role"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND role IN ('vendeur', 'user')
);

-- 2. Coursiers: restrict SELECT to authenticated only
DROP POLICY IF EXISTS "Coursiers viewable by all" ON public.coursiers;
CREATE POLICY "Coursiers viewable by authenticated"
ON public.coursiers
FOR SELECT
TO authenticated
USING (true);

-- 3. Parrainages: constrain self-insert to own filleul_id
DROP POLICY IF EXISTS "sellers_insert_parrainages" ON public.parrainages;
CREATE POLICY "sellers_insert_parrainages"
ON public.parrainages
FOR INSERT
TO authenticated
WITH CHECK (
  filleul_id = public.get_seller_id_for_user(auth.uid())
);

-- 4. Set search_path on functions missing it
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public;
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public;