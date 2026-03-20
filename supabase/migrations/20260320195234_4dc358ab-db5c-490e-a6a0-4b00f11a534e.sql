
-- Trigger to prevent KYC submission without documents
CREATE OR REPLACE FUNCTION public.check_kyc_documents()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  -- Only check when statut_kyc is being set to 'en_attente'
  IF NEW.statut_kyc = 'en_attente' AND (OLD.statut_kyc IS DISTINCT FROM 'en_attente') THEN
    IF NEW.kyc_type_document = 'cni' AND (
      NEW.kyc_document_recto_url IS NULL OR
      NEW.kyc_document_verso_url IS NULL OR
      NEW.kyc_selfie_url IS NULL
    ) THEN
      RAISE EXCEPTION 'KYC CNI incomplet : recto, verso et selfie requis';
    END IF;

    IF NEW.kyc_type_document = 'passeport' AND (
      NEW.kyc_passeport_url IS NULL AND NEW.kyc_document_recto_url IS NULL OR
      NEW.kyc_selfie_url IS NULL
    ) THEN
      RAISE EXCEPTION 'KYC Passeport incomplet : photo passeport et selfie requis';
    END IF;

    IF NEW.kyc_type_document IS NULL THEN
      RAISE EXCEPTION 'Type de document KYC requis';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_check_kyc ON public.sellers;
CREATE TRIGGER trigger_check_kyc
  BEFORE UPDATE ON public.sellers
  FOR EACH ROW
  EXECUTE FUNCTION public.check_kyc_documents();
