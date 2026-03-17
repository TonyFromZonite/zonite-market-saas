
-- Enable realtime for tickets_support and notifications_vendeur (notifications_admin already enabled)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'tickets_support') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE tickets_support;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'notifications_vendeur') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE notifications_vendeur;
  END IF;
END $$;

-- Storage policy: allow authenticated users to read kyc-documents
CREATE POLICY "authenticated_read_kyc_files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'kyc-documents');
