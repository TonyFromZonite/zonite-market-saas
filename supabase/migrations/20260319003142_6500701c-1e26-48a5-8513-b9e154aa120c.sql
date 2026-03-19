
-- Atomic: deduct commission (for cancellations/returns)
CREATE OR REPLACE FUNCTION public.debit_seller_commission(
  _seller_id uuid,
  _amount numeric
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
    solde_commission = GREATEST(0, COALESCE(solde_commission, 0) - _amount),
    total_commissions_gagnees = GREATEST(0, COALESCE(total_commissions_gagnees, 0) - _amount)
  WHERE id = _seller_id
  RETURNING solde_commission INTO new_solde;
  RETURN COALESCE(new_solde, 0);
END;
$$;

-- Atomic: move balance from available to pending (withdrawal request)
CREATE OR REPLACE FUNCTION public.reserve_seller_balance(
  _seller_id uuid,
  _amount numeric
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_solde numeric;
BEGIN
  SELECT COALESCE(solde_commission, 0) INTO current_solde
  FROM public.sellers WHERE id = _seller_id FOR UPDATE;
  
  IF current_solde < _amount THEN
    RAISE EXCEPTION 'Solde insuffisant: % < %', current_solde, _amount;
  END IF;
  
  UPDATE public.sellers
  SET
    solde_commission = solde_commission - _amount,
    solde_en_attente = COALESCE(solde_en_attente, 0) + _amount
  WHERE id = _seller_id
  RETURNING solde_commission INTO current_solde;
  
  RETURN current_solde;
END;
$$;

-- Atomic: approve payment (clear pending, increment paid)
CREATE OR REPLACE FUNCTION public.approve_seller_payment(
  _seller_id uuid,
  _amount numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.sellers
  SET
    solde_en_attente = GREATEST(0, COALESCE(solde_en_attente, 0) - _amount),
    total_commissions_payees = COALESCE(total_commissions_payees, 0) + _amount
  WHERE id = _seller_id;
END;
$$;

-- Atomic: reject payment (restore pending to available)
CREATE OR REPLACE FUNCTION public.restore_seller_balance(
  _seller_id uuid,
  _amount numeric
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
    solde_commission = COALESCE(solde_commission, 0) + _amount,
    solde_en_attente = GREATEST(0, COALESCE(solde_en_attente, 0) - _amount)
  WHERE id = _seller_id
  RETURNING solde_commission INTO new_solde;
  RETURN COALESCE(new_solde, 0);
END;
$$;

-- Atomic: adjust commission (for returns - can be positive or negative)
CREATE OR REPLACE FUNCTION public.adjust_seller_commission(
  _seller_id uuid,
  _delta numeric
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
  SET solde_commission = GREATEST(0, COALESCE(solde_commission, 0) + _delta)
  WHERE id = _seller_id
  RETURNING solde_commission INTO new_solde;
  RETURN COALESCE(new_solde, 0);
END;
$$;
