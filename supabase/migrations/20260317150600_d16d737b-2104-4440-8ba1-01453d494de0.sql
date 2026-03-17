
-- Fix 1: Allow authenticated users to insert their own role
CREATE POLICY "Users insert own role"
ON public.user_roles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Fix 2: Allow any authenticated user to create admin notifications
CREATE POLICY "Authenticated insert admin notifs"
ON public.notifications_admin FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);
