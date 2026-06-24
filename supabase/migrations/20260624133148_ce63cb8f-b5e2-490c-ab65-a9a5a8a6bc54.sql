
-- =====================================================================
-- ANTI-RÉGRESSION : 3 fuites de données sensibles
-- (cf. plan : empêcher prix_achat/marge_zonite/profit_zonite/role-escalation
--  de revenir lisibles côté vendeur)
-- =====================================================================

-- 1) Defense in depth : couper anon des colonnes de marge
--    (les admins restent sur le rôle authenticated et conservent l'accès).
DO $$
BEGIN
  BEGIN
    REVOKE SELECT (prix_achat) ON public.produits FROM anon;
  EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN
    REVOKE SELECT (prix_achat, prix_achat_unitaire, profit_zonite, marge_zonite)
      ON public.ventes FROM anon;
  EXCEPTION WHEN OTHERS THEN NULL; END;
END$$;

-- 2) COMMENTs : balises pour les futurs agents et reviewers
COMMENT ON FUNCTION public.seller_self_update_only_safe(uuid, public.sellers) IS
  '⚠️ SECURITY GUARD — ne pas supprimer. Utilisé par la policy "Users update own seller safe cols" sur public.sellers pour empêcher tout vendeur de modifier role/soldes/statuts/KYC/email/parraine_par. Toute nouvelle policy UPDATE sur sellers accordée aux vendeurs DOIT inclure seller_self_update_only_safe(sellers.id, sellers.*) dans son WITH CHECK. Couvert par src/test/audit-29-fuites-donnees-sensibles.test.ts.';

COMMENT ON VIEW public.produits_public IS
  '⚠️ SECURITY SURFACE — seule lecture autorisée des produits côté vendeur. N''expose PAS prix_achat. Toute nouvelle policy SELECT sur public.produits accordée au rôle authenticated sans restriction admin réintroduit la fuite EXPOSED_SENSITIVE_DATA. Couvert par src/test/audit-29-fuites-donnees-sensibles.test.ts.';

COMMENT ON VIEW public.ventes_vendeur_safe IS
  '⚠️ SECURITY SURFACE — seule lecture autorisée des ventes côté vendeur. N''expose PAS prix_achat, prix_achat_unitaire, prix_gros, profit_zonite, marge_zonite. Toute nouvelle policy SELECT sur public.ventes accordée au rôle authenticated sans restriction admin réintroduit la fuite. Couvert par src/test/audit-29-fuites-donnees-sensibles.test.ts.';

-- 3) Event trigger optionnel : refuse à chaud toute CREATE POLICY visiblement
--    permissive sur produits/ventes/sellers. Si l'environnement ne permet pas
--    la création d'event triggers (droit superuser), on log et on continue —
--    la suite Vitest audit-29 reste le filet principal.
DO $$
DECLARE
  v_can_event_trigger boolean := false;
BEGIN
  -- Test silencieux : est-ce qu'on a le droit ?
  BEGIN
    PERFORM 1 FROM pg_catalog.pg_event_trigger LIMIT 1;
    v_can_event_trigger := true;
  EXCEPTION WHEN insufficient_privilege THEN
    v_can_event_trigger := false;
  END;

  IF NOT v_can_event_trigger THEN
    RAISE NOTICE 'Event triggers non disponibles dans cet environnement — la garde repose sur audit-29 (Vitest CI) et les COMMENTs.';
    RETURN;
  END IF;

  -- Création de la fonction de garde
  EXECUTE $f$
    CREATE OR REPLACE FUNCTION public.guard_no_seller_leak_policy()
    RETURNS event_trigger
    LANGUAGE plpgsql
    AS $body$
    DECLARE
      r record;
      v_policy_name text;
      v_table text;
      v_cmd text;
      v_qual text;
      v_check text;
      v_roles name[];
      v_def text;
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

        -- Règle 1 : SELECT permissif sur produits/ventes pour authenticated/anon
        --           sans clause admin → REJET.
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

        -- Règle 2 : UPDATE sellers pour authenticated sans seller_self_update_only_safe
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
    $body$;
  $f$;

  -- Drop+recreate l'event trigger pour idempotence
  BEGIN
    DROP EVENT TRIGGER IF EXISTS trg_guard_no_seller_leak_policy;
    CREATE EVENT TRIGGER trg_guard_no_seller_leak_policy
      ON ddl_command_end
      WHEN TAG IN ('CREATE POLICY','ALTER POLICY')
      EXECUTE FUNCTION public.guard_no_seller_leak_policy();
    RAISE NOTICE 'Event trigger trg_guard_no_seller_leak_policy installé.';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'Impossible d''installer l''event trigger (droits insuffisants) — fallback sur audit-29.';
  END;
END$$;
