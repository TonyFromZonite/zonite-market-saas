-- Validation trigger: prevent new sellers without ville/quartier
CREATE OR REPLACE FUNCTION public.check_seller_location()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  -- Only validate on step 3 completion (when ville is being set for the first time)
  -- or when seller_status moves past pending_verification with location data
  IF (TG_OP = 'UPDATE') THEN
    -- If ville is being explicitly set to empty/null when it was previously set
    IF (OLD.ville IS NOT NULL AND TRIM(OLD.ville) != '') AND (NEW.ville IS NULL OR TRIM(NEW.ville) = '') THEN
      RAISE EXCEPTION 'La ville est obligatoire et ne peut pas être supprimée';
    END IF;
    IF (OLD.quartier IS NOT NULL AND TRIM(OLD.quartier) != '') AND (NEW.quartier IS NULL OR TRIM(NEW.quartier) = '') THEN
      RAISE EXCEPTION 'Le quartier est obligatoire et ne peut pas être supprimé';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_check_seller_location ON public.sellers;
CREATE TRIGGER trigger_check_seller_location
  BEFORE UPDATE ON public.sellers
  FOR EACH ROW
  EXECUTE FUNCTION public.check_seller_location();