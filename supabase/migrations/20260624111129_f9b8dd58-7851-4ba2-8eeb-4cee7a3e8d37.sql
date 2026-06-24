DO $$
BEGIN
  PERFORM set_config('app.bypass_seller_balance_guard', 'on', true);
  UPDATE public.sellers SET solde_commission = 0 WHERE solde_commission < 0;
  UPDATE public.sellers SET solde_en_attente = 0 WHERE solde_en_attente < 0;
END $$;