
-- 1) Update the guard trigger to honor an internal-RPC bypass flag for balance columns only
CREATE OR REPLACE FUNCTION public.prevent_seller_privileged_updates()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  is_privileged boolean := false;
  kyc_self_submit boolean := false;
  balance_rpc_bypass boolean := false;
BEGIN
  IF current_setting('request.jwt.claim.role', true) = 'service_role'
     OR current_setting('role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NOT NULL
     AND public.is_admin_or_sous_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  -- Internal balance RPCs set this transaction-scoped flag to bypass checks
  -- on balance columns only. Non-balance privileged fields stay locked.
  BEGIN
    balance_rpc_bypass := COALESCE(current_setting('app.bypass_seller_balance_guard', true), '') = 'on';
  EXCEPTION WHEN OTHERS THEN
    balance_rpc_bypass := false;
  END;

  -- Self-service KYC submission
  IF NEW.statut_kyc IS DISTINCT FROM OLD.statut_kyc
     AND NEW.statut_kyc = 'en_attente'
     AND (OLD.statut_kyc IS NULL
          OR OLD.statut_kyc IN ('non_soumis','rejete','en_attente')) THEN
    kyc_self_submit := true;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role
     OR (NEW.seller_status IS DISTINCT FROM OLD.seller_status
         AND NOT (kyc_self_submit AND NEW.seller_status = 'kyc_pending'))
     OR (NEW.statut_kyc IS DISTINCT FROM OLD.statut_kyc AND NOT kyc_self_submit)
     OR NEW.catalogue_debloque IS DISTINCT FROM OLD.catalogue_debloque
     OR NEW.training_completed IS DISTINCT FROM OLD.training_completed
     OR NEW.conditions_acceptees IS DISTINCT FROM OLD.conditions_acceptees
     OR (NEW.solde_commission IS DISTINCT FROM OLD.solde_commission AND NOT balance_rpc_bypass)
     OR (NEW.solde_en_attente IS DISTINCT FROM OLD.solde_en_attente AND NOT balance_rpc_bypass)
     OR (NEW.total_commissions_gagnees IS DISTINCT FROM OLD.total_commissions_gagnees AND NOT balance_rpc_bypass)
     OR (NEW.total_commissions_payees IS DISTINCT FROM OLD.total_commissions_payees AND NOT balance_rpc_bypass)
     OR NEW.email_verified IS DISTINCT FROM OLD.email_verified
     OR NEW.email_verification_code IS DISTINCT FROM OLD.email_verification_code
     OR NEW.email_verification_expires_at IS DISTINCT FROM OLD.email_verification_expires_at
     OR NEW.parraine_par IS DISTINCT FROM OLD.parraine_par
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.email IS DISTINCT FROM OLD.email
  THEN
    is_privileged := true;
  END IF;

  IF is_privileged THEN
    RAISE EXCEPTION 'Modification non autorisée : ces champs sont réservés à l''administration.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$function$;

-- 2) Set the bypass flag inside every legitimate balance-mutating RPC
CREATE OR REPLACE FUNCTION public.reserve_seller_balance(_seller_id uuid, _amount numeric)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  current_solde numeric;
BEGIN
  PERFORM set_config('app.bypass_seller_balance_guard', 'on', true);

  SELECT COALESCE(solde_commission, 0) INTO current_solde
  FROM public.sellers WHERE id = _seller_id FOR UPDATE;

  IF current_solde < _amount THEN
    RAISE EXCEPTION 'Solde insuffisant: % < %', current_solde, _amount;
  END IF;

  UPDATE public.sellers
  SET
    solde_commission = solde_commission - _amount,
    solde_en_attente = COALESCE(solde_en_attente, 0) + _amount
  WHERE id = _seller_id
  RETURNING solde_commission INTO current_solde;

  RETURN current_solde;
END;
$function$;

CREATE OR REPLACE FUNCTION public.approve_seller_payment(_seller_id uuid, _amount numeric)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM set_config('app.bypass_seller_balance_guard', 'on', true);
  UPDATE public.sellers
  SET
    solde_en_attente = GREATEST(0, COALESCE(solde_en_attente, 0) - _amount),
    total_commissions_payees = COALESCE(total_commissions_payees, 0) + _amount
  WHERE id = _seller_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.restore_seller_balance(_seller_id uuid, _amount numeric)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  new_solde numeric;
BEGIN
  PERFORM set_config('app.bypass_seller_balance_guard', 'on', true);
  UPDATE public.sellers
  SET
    solde_commission = COALESCE(solde_commission, 0) + _amount,
    solde_en_attente = GREATEST(0, COALESCE(solde_en_attente, 0) - _amount)
  WHERE id = _seller_id
  RETURNING solde_commission INTO new_solde;
  RETURN COALESCE(new_solde, 0);
END;
$function$;

CREATE OR REPLACE FUNCTION public.credit_seller_commission(_seller_id uuid, _commission numeric)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  new_solde numeric;
BEGIN
  PERFORM set_config('app.bypass_seller_balance_guard', 'on', true);
  UPDATE public.sellers
  SET
    solde_commission = COALESCE(solde_commission, 0) + _commission,
    total_commissions_gagnees = COALESCE(total_commissions_gagnees, 0) + _commission
  WHERE id = _seller_id
  RETURNING solde_commission INTO new_solde;
  RETURN COALESCE(new_solde, 0);
END;
$function$;

CREATE OR REPLACE FUNCTION public.debit_seller_commission(_seller_id uuid, _amount numeric)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  new_solde numeric;
BEGIN
  PERFORM set_config('app.bypass_seller_balance_guard', 'on', true);
  UPDATE public.sellers
  SET
    solde_commission = GREATEST(0, COALESCE(solde_commission, 0) - _amount),
    total_commissions_gagnees = GREATEST(0, COALESCE(total_commissions_gagnees, 0) - _amount)
  WHERE id = _seller_id
  RETURNING solde_commission INTO new_solde;
  RETURN COALESCE(new_solde, 0);
END;
$function$;

CREATE OR REPLACE FUNCTION public.adjust_seller_commission(_seller_id uuid, _delta numeric)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  new_solde numeric;
BEGIN
  PERFORM set_config('app.bypass_seller_balance_guard', 'on', true);
  UPDATE public.sellers
  SET solde_commission = GREATEST(0, COALESCE(solde_commission, 0) + _delta)
  WHERE id = _seller_id
  RETURNING solde_commission INTO new_solde;
  RETURN COALESCE(new_solde, 0);
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_adjust_seller_commission(_seller_id uuid, _delta numeric, _motif text, _admin_email text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_solde_avant numeric;
  v_solde_apres numeric;
  v_email text;
  v_titre text;
  v_message text;
  v_signe text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Accès refusé : admin requis';
  END IF;

  IF _delta = 0 THEN
    RAISE EXCEPTION 'Le montant ne peut pas être 0';
  END IF;

  IF _motif IS NULL OR length(trim(_motif)) < 5 THEN
    RAISE EXCEPTION 'Motif requis (minimum 5 caractères)';
  END IF;

  PERFORM set_config('app.bypass_seller_balance_guard', 'on', true);

  SELECT COALESCE(solde_commission, 0), email
    INTO v_solde_avant, v_email
  FROM public.sellers WHERE id = _seller_id FOR UPDATE;

  IF v_email IS NULL THEN
    RAISE EXCEPTION 'Vendeur introuvable';
  END IF;

  v_solde_apres := GREATEST(0, v_solde_avant + _delta);

  UPDATE public.sellers
  SET
    solde_commission = v_solde_apres,
    total_commissions_gagnees = GREATEST(0, COALESCE(total_commissions_gagnees, 0) + _delta)
  WHERE id = _seller_id;

  INSERT INTO public.ajustements_commission(
    vendeur_id, montant, motif, solde_avant, solde_apres, effectue_par
  ) VALUES (
    _seller_id, _delta, _motif, v_solde_avant, v_solde_apres, _admin_email
  );

  v_signe := CASE WHEN _delta >= 0 THEN '+' ELSE '−' END;
  v_titre := CASE WHEN _delta >= 0 THEN 'Crédit sur votre solde commission' ELSE 'Débit sur votre solde commission' END;
  v_message := 'Votre solde commission a été ajusté de ' || v_signe || abs(_delta)::text || ' FCFA. Motif : ' || _motif || '. Nouveau solde : ' || v_solde_apres::text || ' FCFA.';

  INSERT INTO public.notifications_vendeur(vendeur_id, vendeur_email, titre, message, type)
  VALUES (_seller_id, v_email, v_titre, v_message, CASE WHEN _delta >= 0 THEN 'success' ELSE 'warning' END);

  INSERT INTO public.journal_audit(action, module, utilisateur, entite_type, entite_id, details)
  VALUES (
    'ajustement_solde_commission',
    'commissions',
    _admin_email,
    'sellers',
    _seller_id,
    jsonb_build_object('delta', _delta, 'motif', _motif, 'solde_avant', v_solde_avant, 'solde_apres', v_solde_apres)
  );

  RETURN jsonb_build_object('solde_avant', v_solde_avant, 'solde_apres', v_solde_apres);
END;
$function$;
