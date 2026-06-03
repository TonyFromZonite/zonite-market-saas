-- Trigger de validation : garantit que chaque commande contient une variation valide
-- lorsque le produit en exige (selon produits.variations).
CREATE OR REPLACE FUNCTION public.validate_commande_variation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  -- Récupère la définition des variations du produit
  SELECT variations INTO v_variations FROM public.produits WHERE id = NEW.produit_id;

  -- Détermine si au moins une variation avec options est définie
  IF v_variations IS NOT NULL AND jsonb_typeof(v_variations) = 'array' THEN
    FOR v_var IN SELECT * FROM jsonb_array_elements(v_variations) LOOP
      IF jsonb_typeof(v_var->'options') = 'array'
         AND jsonb_array_length(v_var->'options') > 0 THEN
        v_required := true;
        EXIT;
      END IF;
    END LOOP;
  END IF;

  -- Aucun produit à variations : on accepte (variation peut être NULL)
  IF NOT v_required THEN
    RETURN NEW;
  END IF;

  -- Le produit exige une variation
  IF NEW.variation IS NULL OR length(trim(NEW.variation)) = 0 THEN
    RAISE EXCEPTION 'Variation requise pour ce produit (commande %).', NEW.reference_commande
      USING ERRCODE = 'check_violation';
  END IF;

  -- Découpe la clé "Nom1:V1|Nom2:V2" (ou avec " / ") et vérifie chaque segment
  v_segments := regexp_split_to_array(NEW.variation, '\s*(\||/)\s*');

  FOREACH v_seg IN ARRAY v_segments LOOP
    v_seg := trim(v_seg);
    CONTINUE WHEN v_seg = '';
    -- Format attendu Nom:Valeur
    IF position(':' IN v_seg) = 0 THEN
      RAISE EXCEPTION 'Variation invalide "%": format attendu "Nom:Valeur".', v_seg
        USING ERRCODE = 'check_violation';
    END IF;
    v_var_name := trim(split_part(v_seg, ':', 1));
    v_var_value := trim(substring(v_seg FROM position(':' IN v_seg) + 1));

    IF v_var_name = '' OR v_var_value = '' THEN
      RAISE EXCEPTION 'Variation invalide "%": nom ou valeur vide.', v_seg
        USING ERRCODE = 'check_violation';
    END IF;

    -- Vérifie que (Nom, Valeur) existe dans produits.variations
    v_found := false;
    FOR v_var IN SELECT * FROM jsonb_array_elements(v_variations) LOOP
      IF (v_var->>'nom') = v_var_name THEN
        FOR v_opt IN SELECT * FROM jsonb_array_elements(v_var->'options') LOOP
          IF jsonb_typeof(v_opt) = 'string' THEN
            v_opt_value := trim(both '"' FROM v_opt::text);
          ELSE
            v_opt_value := COALESCE(v_opt->>'value', v_opt->>'nom', v_opt->>'label', '');
          END IF;
          IF v_opt_value = v_var_value THEN
            v_found := true;
            EXIT;
          END IF;
        END LOOP;
      END IF;
      EXIT WHEN v_found;
    END LOOP;

    IF NOT v_found THEN
      RAISE EXCEPTION 'Option "%" inconnue pour la variation "%" du produit.', v_var_value, v_var_name
        USING ERRCODE = 'check_violation';
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_commande_variation ON public.commandes_vendeur;
CREATE TRIGGER trg_validate_commande_variation
BEFORE INSERT OR UPDATE OF variation, produit_id ON public.commandes_vendeur
FOR EACH ROW
EXECUTE FUNCTION public.validate_commande_variation();