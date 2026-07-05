-- =====================================================================
-- Sprint 6: Phone wallet, trial, subscriptions & top-up
-- =====================================================================

-- Plan status enum
DO $$ BEGIN
  CREATE TYPE public.plan_status AS ENUM ('TRIAL', 'ACTIVE', 'RESTRICTED', 'CANCELED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Phone wallets
CREATE TABLE IF NOT EXISTS public.phone_wallets (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_status public.plan_status NOT NULL DEFAULT 'TRIAL',
  plan_name text NOT NULL DEFAULT 'TRIAL',
  included_minutes integer NOT NULL DEFAULT 10,
  included_used_seconds integer NOT NULL DEFAULT 0,
  extra_seconds integer NOT NULL DEFAULT 0,
  trial_ends_at timestamptz,
  cycle_ends_at timestamptz,
  last_reset_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.phone_wallets TO authenticated;
GRANT ALL ON public.phone_wallets TO service_role;

ALTER TABLE public.phone_wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own phone wallet"
  ON public.phone_wallets FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER phone_wallets_updated_at
  BEFORE UPDATE ON public.phone_wallets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Minute transactions
CREATE TABLE IF NOT EXISTS public.minute_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('TRIAL_GRANT','PLAN_RESET','TOPUP','CALL_DEBIT','PLAN_SUBSCRIBE')),
  bucket text NOT NULL CHECK (bucket IN ('INCLUDED','EXTRA','MIXED')),
  minutes_delta numeric(10,2) NOT NULL,
  reference text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_minute_tx_user_created
  ON public.minute_transactions(user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.minute_transactions TO authenticated;
GRANT ALL ON public.minute_transactions TO service_role;

ALTER TABLE public.minute_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own minute tx"
  ON public.minute_transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own minute tx"
  ON public.minute_transactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Auto-create wallet on signup (extend handle_new_user)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name, country_iso)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    NULLIF(NEW.raw_user_meta_data->>'country_iso', '')
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.phone_wallets (
    user_id, plan_status, plan_name,
    included_minutes, included_used_seconds, extra_seconds,
    trial_ends_at, last_reset_at
  )
  VALUES (
    NEW.id, 'TRIAL', 'TRIAL',
    10, 0, 0,
    now() + interval '7 days', now()
  )
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.minute_transactions (user_id, kind, bucket, minutes_delta, reference)
  VALUES (NEW.id, 'TRIAL_GRANT', 'INCLUDED', 10, 'Essai découverte 7 jours');

  RETURN NEW;
END;
$$;

-- Ensure trigger exists on auth.users
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created'
  ) THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
  END IF;
END $$;

-- Backfill wallets for existing users
INSERT INTO public.phone_wallets (user_id, plan_status, plan_name, included_minutes, trial_ends_at, last_reset_at)
SELECT u.id, 'TRIAL', 'TRIAL', 10, now() + interval '7 days', now()
FROM auth.users u
LEFT JOIN public.phone_wallets w ON w.user_id = u.id
WHERE w.user_id IS NULL;

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.phone_wallets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.minute_transactions;
