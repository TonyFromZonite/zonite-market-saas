
-- Create a security definer function to resolve username to email (bypasses RLS)
CREATE OR REPLACE FUNCTION public.resolve_username_to_email(_username text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email FROM (
    SELECT email FROM public.sellers WHERE username = _username
    UNION ALL
    SELECT email FROM public.sous_admins WHERE username = _username
  ) t LIMIT 1;
$$;
