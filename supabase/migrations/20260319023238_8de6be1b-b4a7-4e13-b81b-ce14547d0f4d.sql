CREATE POLICY "Sous-admins view own permissions"
ON public.admin_permissions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.sous_admins sa
    WHERE sa.id = admin_permissions.sous_admin_id
      AND sa.user_id = auth.uid()
  )
);