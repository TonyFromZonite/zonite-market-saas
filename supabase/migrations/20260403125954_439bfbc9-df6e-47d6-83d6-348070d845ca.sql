CREATE OR REPLACE FUNCTION public.get_filleuls_for_parrain(_parrain_id uuid)
RETURNS TABLE(filleul_id uuid, full_name text, seller_status text, created_at timestamptz, livraisons_comptees int, commission_totale numeric, actif boolean)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    p.filleul_id,
    s.full_name,
    s.seller_status,
    p.created_at,
    COALESCE(p.livraisons_comptees, 0),
    COALESCE(p.commission_totale, 0),
    p.actif
  FROM public.parrainages p
  JOIN public.sellers s ON s.id = p.filleul_id
  WHERE p.parrain_id = _parrain_id
  ORDER BY p.created_at DESC;
$$;