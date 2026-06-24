CREATE OR REPLACE FUNCTION public.guard_no_seller_leak_policy()
RETURNS event_trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $function$
DECLARE
  r record;
  v_policy_name text;
  v_table text;
  v_cmd text;
  v_qual text;
  v_check text;
  v_roles name[];
BEGIN
  FOR r IN
    SELECT * FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE POLICY', 'ALTER POLICY')
  LOOP
    SELECT polname, c.relname, p.polcmd, p.polroles
      INTO v_policy_name, v_table, v_cmd, v_roles
    FROM pg_policy p
    JOIN pg_class c ON c.oid = p.polrelid
    WHERE p.oid = r.objid;

    IF v_table NOT IN ('produits','ventes','sellers') THEN CONTINUE; END IF;
    IF v_policy_name ILIKE 'Admins%' THEN CONTINUE; END IF;

    SELECT pg_get_expr(p.polqual, p.polrelid),
           pg_get_expr(p.polwithcheck, p.polrelid)
      INTO v_qual, v_check
    FROM pg_policy p WHERE p.oid = r.objid;

    IF v_table IN ('produits','ventes')
       AND v_cmd IN ('r','*')
       AND COALESCE(v_qual,'') NOT ILIKE '%is_admin_or_sous_admin%'
       AND COALESCE(v_qual,'') NOT ILIKE '%has_role%'
    THEN
      RAISE EXCEPTION
        'Policy "%" sur public.% interdite : tout SELECT/ALL accordé aux vendeurs réintroduit la fuite de prix_achat/marge_zonite. Les vendeurs doivent passer par les vues produits_public / ventes_vendeur_safe.',
        v_policy_name, v_table
        USING ERRCODE = 'insufficient_privilege',
              HINT = 'Voir COMMENT ON VIEW public.produits_public et src/test/audit-29-fuites-donnees-sensibles.test.ts.';
    END IF;

    IF v_table = 'sellers'
       AND v_cmd IN ('w','*')
       AND COALESCE(v_check,'') NOT ILIKE '%seller_self_update_only_safe%'
       AND COALESCE(v_check,'') NOT ILIKE '%is_admin_or_sous_admin%'
       AND COALESCE(v_check,'') NOT ILIKE '%has_role%'
    THEN
      RAISE EXCEPTION
        'Policy "%" sur public.sellers interdite : un UPDATE accordé aux vendeurs DOIT inclure seller_self_update_only_safe(sellers.id, sellers.*) dans son WITH CHECK pour bloquer role/soldes/statuts privilégiés.',
        v_policy_name
        USING ERRCODE = 'insufficient_privilege',
              HINT = 'Voir COMMENT ON FUNCTION public.seller_self_update_only_safe.';
    END IF;
  END LOOP;
END;
$function$;