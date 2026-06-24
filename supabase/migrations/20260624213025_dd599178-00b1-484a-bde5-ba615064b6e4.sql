CREATE OR REPLACE FUNCTION public.guard_no_audit_notif_insert_leak()
RETURNS event_trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
DECLARE
  r record;
  v_policy_name text;
  v_table text;
  v_cmd char;
  v_roles name[];
  v_check text;
  v_role name;
  v_targets_vendor boolean;
BEGIN
  FOR r IN
    SELECT * FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE POLICY','ALTER POLICY')
  LOOP
    SELECT p.polname, c.relname, p.polcmd, p.polroles,
           pg_get_expr(p.polwithcheck, p.polrelid)
      INTO v_policy_name, v_table, v_cmd, v_roles, v_check
    FROM pg_policy p
    JOIN pg_class c ON c.oid = p.polrelid
    WHERE p.oid = r.objid;

    IF v_table NOT IN ('journal_audit','notifications_admin') THEN
      CONTINUE;
    END IF;

    -- Ne s'applique qu'aux policies INSERT ou ALL
    IF v_cmd NOT IN ('a','*') THEN
      CONTINUE;
    END IF;

    -- Détecte si la policy cible authenticated / anon / PUBLIC (oid 0)
    v_targets_vendor := false;
    IF v_roles IS NULL OR array_length(v_roles, 1) IS NULL THEN
      v_targets_vendor := true; -- PUBLIC implicite
    ELSE
      FOREACH v_role IN ARRAY v_roles LOOP
        IF v_role IN ('authenticated','anon','public') THEN
          v_targets_vendor := true;
          EXIT;
        END IF;
      END LOOP;
    END IF;

    IF NOT v_targets_vendor THEN
      CONTINUE;
    END IF;

    -- Tolère uniquement les policies explicitement gardées par admin/sous_admin
    IF COALESCE(v_check,'') ILIKE '%is_admin_or_sous_admin%'
       OR COALESCE(v_check,'') ILIKE '%has_role%' THEN
      CONTINUE;
    END IF;

    RAISE EXCEPTION
      'Policy "%" sur public.% interdite : un INSERT (ou ALL) accordé à authenticated/anon/public sur cette table permet la falsification du journal d''audit ou le spam de la boîte admin. Les écritures DOIVENT passer par une fonction SECURITY DEFINER ou par service_role.',
      v_policy_name, v_table
      USING ERRCODE = 'insufficient_privilege',
            HINT = 'Voir src/test/audit-31-policies-insert-audit-notif.test.ts et la fonction guard_no_audit_notif_insert_leak.';
  END LOOP;
END;
$$;

DROP EVENT TRIGGER IF EXISTS guard_no_audit_notif_insert_leak_trg;
CREATE EVENT TRIGGER guard_no_audit_notif_insert_leak_trg
  ON ddl_command_end
  WHEN TAG IN ('CREATE POLICY','ALTER POLICY')
  EXECUTE FUNCTION public.guard_no_audit_notif_insert_leak();