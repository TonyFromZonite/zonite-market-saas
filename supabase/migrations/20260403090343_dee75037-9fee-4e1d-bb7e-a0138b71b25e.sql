DROP FUNCTION IF EXISTS public.validate_referral_code(text);
CREATE FUNCTION public.validate_referral_code(_code text)
RETURNS TABLE(id uuid, full_name text, email text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id, s.full_name, s.email
  FROM public.sellers s
  WHERE s.code_parrainage = UPPER(TRIM(_code))
  LIMIT 1;
$$;