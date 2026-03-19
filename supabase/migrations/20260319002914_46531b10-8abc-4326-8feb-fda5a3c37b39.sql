
CREATE OR REPLACE FUNCTION public.credit_seller_commission(
  _seller_id uuid,
  _commission numeric
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_solde numeric;
BEGIN
  UPDATE public.sellers
  SET
    solde_commission = COALESCE(solde_commission, 0) + _commission,
    total_commissions_gagnees = COALESCE(total_commissions_gagnees, 0) + _commission
  WHERE id = _seller_id
  RETURNING solde_commission INTO new_solde;
  
  RETURN COALESCE(new_solde, 0);
END;
$$;
