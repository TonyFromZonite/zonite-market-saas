CREATE OR REPLACE FUNCTION public.get_top_vendeurs(_since timestamptz)
RETURNS TABLE(vendeur_id uuid, full_name text, total numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT v.vendeur_id, s.full_name, SUM(v.montant_total) AS total
  FROM public.ventes v
  JOIN public.sellers s ON s.id = v.vendeur_id
  WHERE v.created_at >= _since
  GROUP BY v.vendeur_id, s.full_name
  ORDER BY total DESC
  LIMIT 10;
$$;