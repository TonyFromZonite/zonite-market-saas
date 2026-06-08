
-- 1) Drop legacy permissive policies on storage.objects for KYC bucket
DROP POLICY IF EXISTS "Users read own kyc" ON storage.objects;
DROP POLICY IF EXISTS "Users view KYC docs" ON storage.objects;
DROP POLICY IF EXISTS "authenticated_read_kyc_files" ON storage.objects;
DROP POLICY IF EXISTS "Admins read kyc" ON storage.objects;
DROP POLICY IF EXISTS "Users upload KYC docs" ON storage.objects;
DROP POLICY IF EXISTS "Users upload own kyc" ON storage.objects;
DROP POLICY IF EXISTS "vendors_upload_kyc" ON storage.objects;

-- 2) Lock down realtime broadcast/presence messages.
-- The app only uses postgres_changes, which still works under source-table RLS
-- and is NOT governed by realtime.messages RLS. Enabling RLS here with no
-- policy blocks all client-initiated Broadcast/Presence which we never use.
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Deny all realtime messages" ON realtime.messages;
CREATE POLICY "Deny all realtime messages"
ON realtime.messages
FOR ALL
TO authenticated, anon
USING (false)
WITH CHECK (false);
