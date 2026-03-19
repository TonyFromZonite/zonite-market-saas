-- Drop the old authenticated-only policy
DROP POLICY IF EXISTS "Config viewable" ON public.config_app;

-- Create a new policy that allows everyone (including anonymous) to read config
CREATE POLICY "Config viewable by all"
ON public.config_app
FOR SELECT
TO anon, authenticated
USING (true);