
-- Add missing columns to sellers table
ALTER TABLE public.sellers ADD COLUMN IF NOT EXISTS kyc_document_type TEXT;
ALTER TABLE public.sellers ADD COLUMN IF NOT EXISTS kyc_passeport_url TEXT;
ALTER TABLE public.sellers ADD COLUMN IF NOT EXISTS kyc_submitted_at TIMESTAMPTZ;
ALTER TABLE public.sellers ADD COLUMN IF NOT EXISTS training_completed_at TIMESTAMPTZ;

-- Storage policy for vendors to upload KYC docs (bucket already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'vendors_upload_kyc' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "vendors_upload_kyc"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'kyc-documents');
  END IF;
END $$;
