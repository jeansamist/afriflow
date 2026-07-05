REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (
  first_name,
  last_name,
  country_iso,
  mobile_money_number,
  mobile_money_operator,
  mobile_money_holder_name,
  payout_currency,
  updated_at
) ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;