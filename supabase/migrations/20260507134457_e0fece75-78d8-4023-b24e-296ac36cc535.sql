REVOKE EXECUTE ON FUNCTION public.admin_adjust_seller_commission(uuid, numeric, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_adjust_seller_commission(uuid, numeric, text, text) TO authenticated;

ALTER FUNCTION public.admin_adjust_seller_commission(uuid, numeric, text, text) SET search_path = public;