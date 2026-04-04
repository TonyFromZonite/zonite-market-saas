ALTER TABLE public.sellers ALTER COLUMN statut_kyc SET DEFAULT 'non_soumis';

UPDATE public.sellers 
SET statut_kyc = 'non_soumis' 
WHERE statut_kyc = 'en_attente' 
  AND kyc_document_recto_url IS NULL 
  AND kyc_selfie_url IS NULL 
  AND kyc_passeport_url IS NULL;