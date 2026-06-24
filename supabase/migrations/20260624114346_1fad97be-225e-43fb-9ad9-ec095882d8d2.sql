CREATE OR REPLACE FUNCTION public.restore_seller_balance(_seller_id uuid, _amount numeric)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_en_attente numeric;
  v_to_restore numeric;
  new_solde numeric;
BEGIN
  PERFORM set_config('app.bypass_seller_balance_guard', 'on', true);

  -- Verrouille la ligne et lit le montant réellement réservé
  SELECT COALESCE(solde_en_attente, 0) INTO v_en_attente
  FROM public.sellers WHERE id = _seller_id FOR UPDATE;

  -- Borne la restauration : on ne peut pas restaurer plus que ce qui a été réservé
  v_to_restore := LEAST(COALESCE(_amount, 0), COALESCE(v_en_attente, 0));

  IF v_to_restore <= 0 THEN
    -- Rien à restaurer : on retourne le solde actuel sans modification
    SELECT COALESCE(solde_commission, 0) INTO new_solde
    FROM public.sellers WHERE id = _seller_id;
    RETURN COALESCE(new_solde, 0);
  END IF;

  UPDATE public.sellers
  SET
    solde_commission = COALESCE(solde_commission, 0) + v_to_restore,
    solde_en_attente = GREATEST(0, COALESCE(solde_en_attente, 0) - v_to_restore)
  WHERE id = _seller_id
  RETURNING solde_commission INTO new_solde;

  RETURN COALESCE(new_solde, 0);
END;
$function$;