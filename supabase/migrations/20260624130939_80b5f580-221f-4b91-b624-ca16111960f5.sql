
-- ============================================================================
-- AUDIT 27 — Garde-fou transactionnel : régularisation doit inclure parrainage
-- ============================================================================
-- Contexte : la régularisation du 24/06 a débité 3 vendeurs en oubliant leurs
-- commissions de parrainage. Ce trigger empêche toute future régularisation
-- de baisser total_commissions_gagnees sous le total parrainage légitime.
-- Tout INSERT qui violerait l'invariant déclenche RAISE EXCEPTION => rollback.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.guard_regularisation_inclut_parrainage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_regularisation boolean;
  v_ventes_total       numeric;
  v_parrainage_total   numeric;
  v_autres_ajust_total numeric;
  v_total_gagnees_apres numeric;
  v_minimum_legitime   numeric;
  v_current_gagnees    numeric;
BEGIN
  -- 1) On ne déclenche le contrôle que sur les ajustements dont le motif
  --    ressemble à une régularisation / audit (action en masse).
  --    Les ajustements admin "ponctuels" (bonus, sanction manuelle) restent libres.
  v_is_regularisation := (
    NEW.motif ~* '(régularisation|regularisation|audit cohérence|audit coherence)'
  );

  IF NOT v_is_regularisation THEN
    RETURN NEW;
  END IF;

  -- 2) Recalcule les revenus légitimes du vendeur, parrainage INCLUS.
  SELECT COALESCE(SUM(commission_vendeur), 0)
    INTO v_ventes_total
  FROM public.ventes
  WHERE vendeur_id = NEW.vendeur_id;

  SELECT COALESCE(SUM(commission_totale), 0)
    INTO v_parrainage_total
  FROM public.parrainages
  WHERE parrain_id = NEW.vendeur_id;

  -- 3) Somme des ajustements DÉJÀ enregistrés (avant le NEW en cours).
  SELECT COALESCE(SUM(montant), 0)
    INTO v_autres_ajust_total
  FROM public.ajustements_commission
  WHERE vendeur_id = NEW.vendeur_id;

  -- 4) Lit le total_commissions_gagnees courant pour simulation post-INSERT.
  SELECT COALESCE(total_commissions_gagnees, 0)
    INTO v_current_gagnees
  FROM public.sellers
  WHERE id = NEW.vendeur_id;

  -- Le trigger sur sellers (prevent_seller_privileged_updates) couple déjà
  -- ajustement -> mise à jour total_commissions_gagnees. On simule l'état final.
  v_total_gagnees_apres := GREATEST(0, v_current_gagnees + COALESCE(NEW.montant, 0));

  -- 5) MINIMUM légitime = ventes + parrainage + ajustements positifs antérieurs.
  --    On tolère qu'un admin descende le solde pour annuler des bonus passés
  --    (ajustements positifs antérieurs), mais on REFUSE qu'il descende sous
  --    la somme ventes + parrainage, qui sont des revenus réellement gagnés.
  v_minimum_legitime := v_ventes_total + v_parrainage_total;

  -- 6) Garde-fou : un débit qui passerait sous le minimum est rejeté.
  IF NEW.montant < 0 AND v_total_gagnees_apres < v_minimum_legitime THEN
    RAISE EXCEPTION
      'Régularisation rejetée pour vendeur % : le débit de % FCFA laisserait total_commissions_gagnees=% en dessous du minimum légitime=% (ventes=% + parrainage=%). Toute régularisation DOIT recharger les commissions de parrainage. Motif soumis : "%"',
      NEW.vendeur_id,
      NEW.montant,
      v_total_gagnees_apres,
      v_minimum_legitime,
      v_ventes_total,
      v_parrainage_total,
      NEW.motif
      USING ERRCODE = 'check_violation',
            HINT = 'Inclure Σ parrainages.commission_totale (parrain_id = vendeur_id) dans le calcul du solde attendu avant de proposer un delta.';
  END IF;

  -- 7) Trace l'événement légitime dans le journal d'audit (sécurité d'audit).
  INSERT INTO public.journal_audit(
    action, module, utilisateur, entite_type, entite_id, details
  ) VALUES (
    'regularisation_validee_par_garde_fou',
    'commissions',
    COALESCE(NEW.effectue_par, 'system'),
    'sellers',
    NEW.vendeur_id,
    jsonb_build_object(
      'delta', NEW.montant,
      'motif', NEW.motif,
      'ventes_total', v_ventes_total,
      'parrainage_total', v_parrainage_total,
      'autres_ajustements', v_autres_ajust_total,
      'total_gagnees_avant', v_current_gagnees,
      'total_gagnees_apres', v_total_gagnees_apres,
      'minimum_legitime', v_minimum_legitime
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_regularisation_inclut_parrainage
  ON public.ajustements_commission;

CREATE TRIGGER trg_guard_regularisation_inclut_parrainage
  BEFORE INSERT ON public.ajustements_commission
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_regularisation_inclut_parrainage();

COMMENT ON FUNCTION public.guard_regularisation_inclut_parrainage() IS
  'AUDIT 27 — Refuse toute régularisation/audit qui ferait passer total_commissions_gagnees sous (ventes + parrainage). Rollback automatique via RAISE EXCEPTION.';
