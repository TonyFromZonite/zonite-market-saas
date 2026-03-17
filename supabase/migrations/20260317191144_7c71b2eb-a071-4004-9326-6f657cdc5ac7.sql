
-- Drop restrictive authenticated-only SELECT policies and replace with public ones for reference data

-- villes_cameroun
DROP POLICY IF EXISTS "Villes viewable by authenticated" ON public.villes_cameroun;
CREATE POLICY "Villes viewable by all"
  ON public.villes_cameroun
  FOR SELECT
  TO public
  USING (true);

-- quartiers
DROP POLICY IF EXISTS "Quartiers viewable by authenticated" ON public.quartiers;
CREATE POLICY "Quartiers viewable by all"
  ON public.quartiers
  FOR SELECT
  TO public
  USING (true);

-- zones_livraison
DROP POLICY IF EXISTS "Zones viewable by authenticated" ON public.zones_livraison;
CREATE POLICY "Zones viewable by all"
  ON public.zones_livraison
  FOR SELECT
  TO public
  USING (true);

-- coursiers
DROP POLICY IF EXISTS "Coursiers viewable by authenticated" ON public.coursiers;
CREATE POLICY "Coursiers viewable by all"
  ON public.coursiers
  FOR SELECT
  TO public
  USING (true);
