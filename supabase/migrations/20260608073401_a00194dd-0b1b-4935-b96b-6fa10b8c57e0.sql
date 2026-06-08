
-- RLS policies for kyc-documents bucket (now private)
-- Path format: kyc/<seller_id>/<file>

DROP POLICY IF EXISTS "Vendors manage own KYC files" ON storage.objects;
DROP POLICY IF EXISTS "Admins manage all KYC files" ON storage.objects;
DROP POLICY IF EXISTS "Public read kyc" ON storage.objects;

CREATE POLICY "Vendors manage own KYC files"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'kyc-documents'
  AND (storage.foldername(name))[2] = public.get_seller_id_for_user(auth.uid())::text
)
WITH CHECK (
  bucket_id = 'kyc-documents'
  AND (storage.foldername(name))[2] = public.get_seller_id_for_user(auth.uid())::text
);

CREATE POLICY "Admins manage all KYC files"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'kyc-documents'
  AND public.has_role(auth.uid(), 'admin')
)
WITH CHECK (
  bucket_id = 'kyc-documents'
  AND public.has_role(auth.uid(), 'admin')
);
