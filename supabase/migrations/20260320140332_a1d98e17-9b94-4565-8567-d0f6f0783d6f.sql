
-- Allow authenticated users to insert notifications for other vendors (needed for referral notifications)
CREATE POLICY "Authenticated insert vendor notifs"
ON public.notifications_vendeur
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);
