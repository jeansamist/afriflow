
-- ============================================
-- 1) Daily payment limit helper (500 EUR/day)
-- ============================================
CREATE OR REPLACE FUNCTION public.daily_payment_total_eur(_user_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(
    CASE
      WHEN UPPER(pl.currency) = 'EUR' THEN pl.amount
      ELSE pl.amount * COALESCE(
        (SELECT fr.rate
           FROM public.fx_rates fr
          WHERE UPPER(fr.base_currency) = UPPER(pl.currency)
            AND UPPER(fr.quote_currency) = 'EUR'
          ORDER BY fr.fetched_at DESC NULLS LAST
          LIMIT 1),
        1
      )
    END
  ), 0)::numeric
  FROM public.payment_links pl
  WHERE pl.user_id = _user_id
    AND pl.created_at >= date_trunc('day', now() AT TIME ZONE 'UTC');
$$;

GRANT EXECUTE ON FUNCTION public.daily_payment_total_eur(uuid) TO authenticated, service_role;

-- ============================================
-- 2) Allowed call countries on wallet
-- ============================================
ALTER TABLE public.phone_wallets
  ADD COLUMN IF NOT EXISTS allowed_call_countries text[] NOT NULL DEFAULT ARRAY['FR','BE','DE','CA']::text[];

-- ============================================
-- 3) SECURITY — phone_wallets: SELECT-only for users
-- ============================================
DROP POLICY IF EXISTS "Users manage own phone wallet" ON public.phone_wallets;

CREATE POLICY "Users view own phone wallet"
  ON public.phone_wallets
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Service role retains full access via GRANT ALL (already in place); revoke writes from authenticated
REVOKE INSERT, UPDATE, DELETE ON public.phone_wallets FROM authenticated;
GRANT SELECT ON public.phone_wallets TO authenticated;
GRANT ALL ON public.phone_wallets TO service_role;

-- ============================================
-- 4) SECURITY — minute_transactions: SELECT-only for users
-- ============================================
DROP POLICY IF EXISTS "Users insert own minute tx" ON public.minute_transactions;

REVOKE INSERT, UPDATE, DELETE ON public.minute_transactions FROM authenticated;
GRANT SELECT ON public.minute_transactions TO authenticated;
GRANT ALL ON public.minute_transactions TO service_role;

-- ============================================
-- 5) SECURITY — realtime.messages: restrict to postgres_changes
-- ============================================
DO $$
BEGIN
  EXECUTE 'ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY';
EXCEPTION WHEN OTHERS THEN
  -- Already enabled or not permitted; ignore
  NULL;
END$$;

DROP POLICY IF EXISTS "Restrict realtime channels to postgres_changes" ON realtime.messages;

DO $$
BEGIN
  EXECUTE $POL$
    CREATE POLICY "Restrict realtime channels to postgres_changes"
      ON realtime.messages
      FOR SELECT
      TO authenticated
      USING (extension = 'postgres_changes')
  $POL$;
EXCEPTION WHEN OTHERS THEN
  NULL;
END$$;
