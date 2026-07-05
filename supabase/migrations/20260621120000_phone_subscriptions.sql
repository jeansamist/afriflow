-- Phone subscription support: Twilio number rental via Stripe

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id text UNIQUE,
  ADD COLUMN IF NOT EXISTS phone_onboarding_completed boolean NOT NULL DEFAULT false;

ALTER TABLE public.phone_allocations
  ADD COLUMN IF NOT EXISTS twilio_sid text UNIQUE;

CREATE TABLE IF NOT EXISTS public.phone_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  phone_allocation_id uuid REFERENCES public.phone_allocations(id) ON DELETE SET NULL,
  stripe_subscription_id text UNIQUE NOT NULL,
  stripe_customer_id text NOT NULL,
  stripe_checkout_session_id text,
  status text NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'ACTIVE', 'PAST_DUE', 'CANCELLED')),
  phone_number text NOT NULL,
  country_iso text NOT NULL,
  twilio_sid text,
  monthly_price_usd numeric(8,2) NOT NULL,
  current_period_end timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS phone_subscriptions_user_idx
  ON public.phone_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS phone_subscriptions_stripe_sub_idx
  ON public.phone_subscriptions(stripe_subscription_id);

GRANT SELECT ON public.phone_subscriptions TO authenticated;
GRANT ALL ON public.phone_subscriptions TO service_role;

ALTER TABLE public.phone_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own phone subscriptions"
  ON public.phone_subscriptions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER phone_subscriptions_updated_at
  BEFORE UPDATE ON public.phone_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
