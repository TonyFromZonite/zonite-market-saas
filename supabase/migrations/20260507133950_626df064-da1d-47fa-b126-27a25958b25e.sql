CREATE TABLE public.ajustements_commission (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendeur_id uuid NOT NULL,
  montant numeric NOT NULL,
  motif text NOT NULL,
  solde_avant numeric NOT NULL DEFAULT 0,
  solde_apres numeric NOT NULL DEFAULT 0,
  effectue_par text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ajustements_vendeur ON public.ajustements_commission(vendeur_id, created_at DESC);

ALTER TABLE public.ajustements_commission ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage ajustements"
  ON public.ajustements_commission FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Sellers view own ajustements"
  ON public.ajustements_commission FOR SELECT
  USING (vendeur_id = public.get_seller_id_for_user(auth.uid()));

CREATE OR REPLACE FUNCTION public.admin_adjust_seller_commission(
  _seller_id uuid,
  _delta numeric,
  _motif text,
  _admin_email text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_solde_avant numeric;
  v_solde_apres numeric;
  v_email text;
  v_titre text;
  v_message text;
  v_signe text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Accès refusé : admin requis';
  END IF;

  IF _delta = 0 THEN
    RAISE EXCEPTION 'Le montant ne peut pas être 0';
  END IF;

  IF _motif IS NULL OR length(trim(_motif)) < 5 THEN
    RAISE EXCEPTION 'Motif requis (minimum 5 caractères)';
  END IF;

  SELECT COALESCE(solde_commission, 0), email
    INTO v_solde_avant, v_email
  FROM public.sellers WHERE id = _seller_id FOR UPDATE;

  IF v_email IS NULL THEN
    RAISE EXCEPTION 'Vendeur introuvable';
  END IF;

  v_solde_apres := GREATEST(0, v_solde_avant + _delta);

  UPDATE public.sellers
  SET
    solde_commission = v_solde_apres,
    total_commissions_gagnees = GREATEST(0, COALESCE(total_commissions_gagnees, 0) + _delta)
  WHERE id = _seller_id;

  INSERT INTO public.ajustements_commission(
    vendeur_id, montant, motif, solde_avant, solde_apres, effectue_par
  ) VALUES (
    _seller_id, _delta, _motif, v_solde_avant, v_solde_apres, _admin_email
  );

  v_signe := CASE WHEN _delta >= 0 THEN '+' ELSE '−' END;
  v_titre := CASE WHEN _delta >= 0 THEN 'Crédit sur votre solde commission' ELSE 'Débit sur votre solde commission' END;
  v_message := 'Votre solde commission a été ajusté de ' || v_signe || abs(_delta)::text || ' FCFA. Motif : ' || _motif || '. Nouveau solde : ' || v_solde_apres::text || ' FCFA.';

  INSERT INTO public.notifications_vendeur(vendeur_id, vendeur_email, titre, message, type)
  VALUES (_seller_id, v_email, v_titre, v_message, CASE WHEN _delta >= 0 THEN 'success' ELSE 'warning' END);

  INSERT INTO public.journal_audit(action, module, utilisateur, entite_type, entite_id, details)
  VALUES (
    'ajustement_solde_commission',
    'commissions',
    _admin_email,
    'sellers',
    _seller_id,
    jsonb_build_object('delta', _delta, 'motif', _motif, 'solde_avant', v_solde_avant, 'solde_apres', v_solde_apres)
  );

  RETURN jsonb_build_object('solde_avant', v_solde_avant, 'solde_apres', v_solde_apres);
END;
$$;