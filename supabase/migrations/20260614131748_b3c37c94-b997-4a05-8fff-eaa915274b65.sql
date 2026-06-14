
-- 1) Trigger tolérant à la casse / espaces
CREATE OR REPLACE FUNCTION public.validate_commande_variation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_variations jsonb;
  v_required boolean := false;
  v_segments text[];
  v_seg text;
  v_var_name text;
  v_var_value text;
  v_found boolean;
  v_var jsonb;
  v_opt jsonb;
  v_opt_value text;
BEGIN
  SELECT variations INTO v_variations FROM public.produits WHERE id = NEW.produit_id;

  IF v_variations IS NOT NULL AND jsonb_typeof(v_variations) = 'array' THEN
    FOR v_var IN SELECT * FROM jsonb_array_elements(v_variations) LOOP
      IF jsonb_typeof(v_var->'options') = 'array'
         AND jsonb_array_length(v_var->'options') > 0 THEN
        v_required := true;
        EXIT;
      END IF;
    END LOOP;
  END IF;

  IF NOT v_required THEN
    RETURN NEW;
  END IF;

  IF NEW.variation IS NULL OR length(trim(NEW.variation)) = 0 THEN
    RAISE EXCEPTION 'Variation requise pour ce produit (commande %).', NEW.reference_commande
      USING ERRCODE = 'check_violation';
  END IF;

  v_segments := regexp_split_to_array(NEW.variation, '\s*(\||/)\s*');

  FOREACH v_seg IN ARRAY v_segments LOOP
    v_seg := trim(v_seg);
    CONTINUE WHEN v_seg = '';
    IF position(':' IN v_seg) = 0 THEN
      RAISE EXCEPTION 'Variation invalide "%": format attendu "Nom:Valeur".', v_seg
        USING ERRCODE = 'check_violation';
    END IF;
    v_var_name := lower(trim(split_part(v_seg, ':', 1)));
    v_var_value := lower(trim(substring(v_seg FROM position(':' IN v_seg) + 1)));

    IF v_var_name = '' OR v_var_value = '' THEN
      RAISE EXCEPTION 'Variation invalide "%": nom ou valeur vide.', v_seg
        USING ERRCODE = 'check_violation';
    END IF;

    v_found := false;
    FOR v_var IN SELECT * FROM jsonb_array_elements(v_variations) LOOP
      IF lower(trim(v_var->>'nom')) = v_var_name THEN
        FOR v_opt IN SELECT * FROM jsonb_array_elements(v_var->'options') LOOP
          IF jsonb_typeof(v_opt) = 'string' THEN
            v_opt_value := trim(both '"' FROM v_opt::text);
          ELSE
            v_opt_value := COALESCE(v_opt->>'value', v_opt->>'nom', v_opt->>'label', '');
          END IF;
          IF lower(trim(v_opt_value)) = v_var_value THEN
            v_found := true;
            EXIT;
          END IF;
        END LOOP;
      END IF;
      EXIT WHEN v_found;
    END LOOP;

    IF NOT v_found THEN
      RAISE EXCEPTION 'Option "%" inconnue pour la variation "%" du produit.',
        split_part(v_seg, ':', 2), split_part(v_seg, ':', 1)
        USING ERRCODE = 'check_violation';
    END IF;
  END LOOP;

  RETURN NEW;
END;
$function$;

-- 2) Réaligner les variation_key historiques sur les noms/valeurs actuels
WITH defs AS (
  SELECT
    p.id AS produit_id,
    lower(trim(v->>'nom')) AS nom_lc,
    v->>'nom' AS nom_canonical,
    lower(trim(COALESCE(o->>'value', o->>'nom', o->>'label', ''))) AS val_lc,
    COALESCE(o->>'value', o->>'nom', o->>'label', '') AS val_canonical
  FROM public.produits p
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(p.variations, '[]'::jsonb)) v
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(v->'options', '[]'::jsonb)) o
  WHERE jsonb_typeof(p.variations) = 'array'
),
exploded AS (
  SELECT
    p.id AS produit_id,
    sc_idx,
    sv_idx,
    sv->>'variation_key' AS old_key,
    sv->'quantite' AS quantite,
    seg_idx,
    trim(seg) AS seg_raw
  FROM public.produits p
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(p.stocks_par_coursier, '[]'::jsonb)) WITH ORDINALITY sc(sc_val, sc_idx)
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(sc.sc_val->'stock_par_variation', '[]'::jsonb)) WITH ORDINALITY sv_t(sv, sv_idx)
  CROSS JOIN LATERAL regexp_split_to_table(COALESCE(sv->>'variation_key',''), '\s*(\||/)\s*') WITH ORDINALITY seg_t(seg, seg_idx)
  WHERE jsonb_typeof(COALESCE(p.stocks_par_coursier,'[]'::jsonb)) = 'array'
),
mapped AS (
  SELECT
    e.produit_id, e.sc_idx, e.sv_idx, e.old_key, e.seg_idx,
    CASE
      WHEN position(':' IN e.seg_raw) = 0 THEN e.seg_raw
      ELSE COALESCE(
        (SELECT d.nom_canonical || ':' || d.val_canonical
           FROM defs d
          WHERE d.produit_id = e.produit_id
            AND d.nom_lc = lower(trim(split_part(e.seg_raw, ':', 1)))
            AND d.val_lc = lower(trim(substring(e.seg_raw FROM position(':' IN e.seg_raw) + 1)))
          LIMIT 1),
        e.seg_raw
      )
    END AS new_seg
  FROM exploded e
),
rebuilt_keys AS (
  SELECT produit_id, sc_idx, sv_idx, old_key,
         string_agg(new_seg, '|' ORDER BY seg_idx) AS new_key
  FROM mapped
  GROUP BY produit_id, sc_idx, sv_idx, old_key
),
rebuilt_sv AS (
  SELECT
    p.id AS produit_id, sc.sc_idx,
    jsonb_agg(
      jsonb_set(sv.sv, '{variation_key}', to_jsonb(COALESCE(rk.new_key, sv.sv->>'variation_key')))
      ORDER BY sv.sv_idx
    ) AS new_spv
  FROM public.produits p
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(p.stocks_par_coursier,'[]'::jsonb)) WITH ORDINALITY sc(sc_val, sc_idx)
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(sc.sc_val->'stock_par_variation','[]'::jsonb)) WITH ORDINALITY sv(sv, sv_idx)
  LEFT JOIN rebuilt_keys rk
    ON rk.produit_id = p.id AND rk.sc_idx = sc.sc_idx AND rk.sv_idx = sv.sv_idx
  WHERE jsonb_typeof(COALESCE(p.stocks_par_coursier,'[]'::jsonb)) = 'array'
  GROUP BY p.id, sc.sc_idx
),
rebuilt_sc AS (
  SELECT
    p.id AS produit_id,
    jsonb_agg(
      jsonb_set(sc.sc_val, '{stock_par_variation}', COALESCE(rsv.new_spv, sc.sc_val->'stock_par_variation'))
      ORDER BY sc.sc_idx
    ) AS new_spc
  FROM public.produits p
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(p.stocks_par_coursier,'[]'::jsonb)) WITH ORDINALITY sc(sc_val, sc_idx)
  LEFT JOIN rebuilt_sv rsv
    ON rsv.produit_id = p.id AND rsv.sc_idx = sc.sc_idx
  WHERE jsonb_typeof(COALESCE(p.stocks_par_coursier,'[]'::jsonb)) = 'array'
  GROUP BY p.id
)
UPDATE public.produits p
SET stocks_par_coursier = r.new_spc
FROM rebuilt_sc r
WHERE r.produit_id = p.id
  AND p.stocks_par_coursier IS DISTINCT FROM r.new_spc;
