
CREATE OR REPLACE FUNCTION public.prevent_seller_privileged_updates()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  is_privileged boolean := false;
  kyc_self_submit boolean := false;
BEGIN
  IF current_setting('request.jwt.claim.role', true) = 'service_role'
     OR current_setting('role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NOT NULL
     AND public.is_admin_or_sous_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  -- Self-service KYC submission: seller transitions statut_kyc -> en_attente
  -- (and optionally seller_status -> kyc_pending) from an allowed prior state.
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
     OR NEW.solde_commission IS DISTINCT FROM OLD.solde_commission
     OR NEW.solde_en_attente IS DISTINCT FROM OLD.solde_en_attente
     OR NEW.total_commissions_gagnees IS DISTINCT FROM OLD.total_commissions_gagnees
     OR NEW.total_commissions_payees IS DISTINCT FROM OLD.total_commissions_payees
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
