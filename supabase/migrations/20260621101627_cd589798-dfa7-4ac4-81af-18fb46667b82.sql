
-- 1) parrainages: enforce zero values on self-insert
DROP POLICY IF EXISTS sellers_insert_parrainages ON public.parrainages;
CREATE POLICY sellers_insert_parrainages
ON public.parrainages
FOR INSERT
TO authenticated
WITH CHECK (
  filleul_id = public.get_seller_id_for_user(auth.uid())
  AND COALESCE(commission_totale, 0) = 0
  AND COALESCE(livraisons_comptees, 0) = 0
);

-- 2) sellers: defense-in-depth WITH CHECK on self-update
DROP POLICY IF EXISTS "Users update own seller" ON public.sellers;
CREATE POLICY "Users update own seller"
ON public.sellers
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 3) tickets_support: allow seller to update only their own ticket,
--    blocking changes to ownership/identity fields (lu_par_vendeur is the
--    intended writable flag).
CREATE POLICY "Sellers update own tickets read flag"
ON public.tickets_support
FOR UPDATE
TO authenticated
USING (vendeur_id = public.get_seller_id_for_user(auth.uid()))
WITH CHECK (vendeur_id = public.get_seller_id_for_user(auth.uid()));

-- Trigger to prevent sellers from modifying anything other than lu_par_vendeur.
CREATE OR REPLACE FUNCTION public.prevent_seller_ticket_field_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF current_setting('request.jwt.claim.role', true) = 'service_role'
     OR current_setting('role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NOT NULL
     AND public.is_admin_or_sous_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF NEW.vendeur_id     IS DISTINCT FROM OLD.vendeur_id
     OR NEW.vendeur_email IS DISTINCT FROM OLD.vendeur_email
     OR NEW.sujet         IS DISTINCT FROM OLD.sujet
     OR NEW.message       IS DISTINCT FROM OLD.message
     OR NEW.categorie     IS DISTINCT FROM OLD.categorie
     OR NEW.priorite      IS DISTINCT FROM OLD.priorite
     OR NEW.statut        IS DISTINCT FROM OLD.statut
     OR NEW.reponse_admin IS DISTINCT FROM OLD.reponse_admin
     OR NEW.repondu_par   IS DISTINCT FROM OLD.repondu_par
     OR NEW.repondu_at    IS DISTINCT FROM OLD.repondu_at
     OR NEW.lu_par_admin  IS DISTINCT FROM OLD.lu_par_admin
  THEN
    RAISE EXCEPTION 'Modification non autorisée : seuls les administrateurs peuvent modifier ces champs.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_seller_ticket_field_changes ON public.tickets_support;
CREATE TRIGGER trg_prevent_seller_ticket_field_changes
BEFORE UPDATE ON public.tickets_support
FOR EACH ROW EXECUTE FUNCTION public.prevent_seller_ticket_field_changes();
