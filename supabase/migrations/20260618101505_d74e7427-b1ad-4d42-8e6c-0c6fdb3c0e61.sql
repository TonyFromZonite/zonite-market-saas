-- 1. Remove sellers from the Realtime publication to prevent leaking
--    email_verification_code, KYC URLs, balances, etc. through change events.
ALTER PUBLICATION supabase_realtime DROP TABLE public.sellers;

-- 2. Trigger to prevent vendors from self-escalating privileges by updating
--    sensitive columns on their own sellers row. Admins and service_role
--    bypass this check.
CREATE OR REPLACE FUNCTION public.prevent_seller_privileged_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_privileged boolean := false;
BEGIN
  -- Service role bypass (edge functions using the service key).
  IF current_setting('request.jwt.claim.role', true) = 'service_role'
     OR current_setting('role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Admin / sous-admin bypass.
  IF auth.uid() IS NOT NULL
     AND public.is_admin_or_sous_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  -- For everyone else (the vendor updating their own row), reject any change
  -- to privileged columns.
  IF NEW.role IS DISTINCT FROM OLD.role
     OR NEW.seller_status IS DISTINCT FROM OLD.seller_status
     OR NEW.statut_kyc IS DISTINCT FROM OLD.statut_kyc
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
$$;

DROP TRIGGER IF EXISTS trg_prevent_seller_privileged_updates ON public.sellers;
CREATE TRIGGER trg_prevent_seller_privileged_updates
BEFORE UPDATE ON public.sellers
FOR EACH ROW
EXECUTE FUNCTION public.prevent_seller_privileged_updates();