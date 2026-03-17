-- Storage RLS policies for kyc-documents bucket
-- Allow authenticated users to upload their own KYC files
CREATE POLICY "Users upload own kyc" ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'kyc-documents');

-- Allow admins to read all KYC files  
CREATE POLICY "Admins read kyc" ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'kyc-documents' AND public.is_admin_or_sous_admin(auth.uid()));

-- Allow users to read their own uploaded files
CREATE POLICY "Users read own kyc" ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'kyc-documents' AND (auth.uid() IS NOT NULL));

-- Make bucket public so images can be displayed via public URLs
UPDATE storage.buckets SET public = true WHERE id = 'kyc-documents';