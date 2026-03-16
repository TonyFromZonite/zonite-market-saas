
-- Fix the permissive INSERT policy on sellers to require auth OR service role
DROP POLICY "Anyone can insert sellers" ON public.sellers;
CREATE POLICY "Authenticated users can insert sellers" ON public.sellers FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Fix the permissive INSERT policy on journal_audit
DROP POLICY "Anyone insert audit" ON public.journal_audit;
CREATE POLICY "Authenticated users insert audit" ON public.journal_audit FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
