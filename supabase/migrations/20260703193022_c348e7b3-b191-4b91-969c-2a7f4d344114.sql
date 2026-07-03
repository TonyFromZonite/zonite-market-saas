CREATE OR REPLACE FUNCTION public.create_admin_notification(
  p_type text,
  p_titre text,
  p_message text,
  p_reference_id uuid DEFAULT NULL,
  p_vendeur_email text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_uid uuid := auth.uid();
  v_email text;
  v_recent int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentification requise' USING ERRCODE = '42501';
  END IF;

  IF p_type IS NULL OR p_type NOT IN ('kyc','support','commande','paiement','vendeur','info') THEN
    RAISE EXCEPTION 'Type de notification invalide: %', p_type USING ERRCODE = '22023';
  END IF;

  IF p_titre IS NULL OR length(trim(p_titre)) = 0 THEN
    RAISE EXCEPTION 'Titre requis' USING ERRCODE = '22023';
  END IF;

  v_email := COALESCE(
    NULLIF(trim(p_vendeur_email), ''),
    (SELECT email FROM public.sellers WHERE user_id = v_uid LIMIT 1),
    (SELECT email FROM public.sous_admins WHERE user_id = v_uid LIMIT 1)
  );

  -- Anti-spam : max 20 notifications admin / 5 min / utilisateur.
  SELECT count(*) INTO v_recent
  FROM public.notifications_admin
  WHERE created_at > now() - interval '5 minutes'
    AND vendeur_email IS NOT NULL
    AND vendeur_email = v_email;

  IF v_recent > 20 THEN
    RAISE EXCEPTION 'Trop de notifications récentes, réessayez plus tard.' USING ERRCODE = '54000';
  END IF;

  INSERT INTO public.notifications_admin (type, titre, message, reference_id, vendeur_email, lu)
  VALUES (
    p_type,
    left(p_titre, 200),
    left(COALESCE(p_message, ''), 1000),
    p_reference_id,
    v_email,
    false
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_admin_notification(text, text, text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_admin_notification(text, text, text, uuid, text) TO authenticated;

COMMENT ON FUNCTION public.create_admin_notification(text, text, text, uuid, text) IS
  'Insert into notifications_admin depuis un utilisateur authentifié (vendeur/admin). SECURITY DEFINER contourne RLS sans policy permissive (compat. sentinelle audit-31). Rate limit 20/5min/email.';
