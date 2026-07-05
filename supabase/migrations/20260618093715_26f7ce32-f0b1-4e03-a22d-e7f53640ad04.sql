
-- FX rates cache
CREATE TABLE public.fx_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  base_currency text NOT NULL,
  quote_currency text NOT NULL,
  rate numeric NOT NULL CHECK (rate > 0),
  source text NOT NULL DEFAULT 'frankfurter',
  fetched_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX fx_rates_pair_idx ON public.fx_rates (base_currency, quote_currency, fetched_at DESC);

GRANT SELECT ON public.fx_rates TO authenticated, anon;
GRANT ALL ON public.fx_rates TO service_role;

ALTER TABLE public.fx_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fx_rates readable by all" ON public.fx_rates FOR SELECT USING (true);

-- Lock rate on payment_links
ALTER TABLE public.payment_links
  ADD COLUMN IF NOT EXISTS local_currency text,
  ADD COLUMN IF NOT EXISTS local_amount numeric,
  ADD COLUMN IF NOT EXISTS fx_rate numeric,
  ADD COLUMN IF NOT EXISTS fx_locked_at timestamptz;

-- Preferred payout currency on profiles (derived from country but overridable)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS payout_currency text;
