
CREATE TYPE public.payout_status_type AS ENUM ('PENDING','PROCESSING','SENT','FAILED');

CREATE TABLE public.payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  payment_link_id uuid REFERENCES public.payment_links(id) ON DELETE SET NULL,
  gross_amount numeric(12,2) NOT NULL,
  gross_currency text NOT NULL,
  fee_amount numeric(12,2) NOT NULL DEFAULT 0,
  net_amount numeric(12,2) NOT NULL,
  local_amount numeric(14,2),
  local_currency text,
  fx_rate numeric,
  mobile_money_operator text,
  mobile_money_number text,
  mobile_money_holder_name text,
  status public.payout_status_type NOT NULL DEFAULT 'PENDING',
  provider text NOT NULL DEFAULT 'flutterwave_simulated',
  provider_reference text,
  failure_reason text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX payouts_user_id_idx ON public.payouts(user_id);
CREATE INDEX payouts_status_idx ON public.payouts(status);
CREATE INDEX payouts_created_at_idx ON public.payouts(created_at DESC);

GRANT SELECT ON public.payouts TO authenticated;
GRANT ALL ON public.payouts TO service_role;

ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Versements lisibles par leur propriétaire"
  ON public.payouts FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER trg_payouts_updated_at
  BEFORE UPDATE ON public.payouts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.payouts;
ALTER TABLE public.payouts REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.payment_links;
ALTER TABLE public.payment_links REPLICA IDENTITY FULL;
