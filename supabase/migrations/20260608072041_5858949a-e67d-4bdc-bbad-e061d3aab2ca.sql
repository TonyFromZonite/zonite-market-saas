DROP POLICY IF EXISTS "Authenticated insert sellers" ON public.sellers;
CREATE POLICY "Users insert own seller"
ON public.sellers
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);