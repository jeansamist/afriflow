CREATE TABLE public.phone_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  e164 TEXT NOT NULL UNIQUE,
  country_iso TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'SIMULATED',
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.phone_allocations TO authenticated;
GRANT ALL ON public.phone_allocations TO service_role;

ALTER TABLE public.phone_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own allocations" ON public.phone_allocations
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER phone_allocations_updated_at
  BEFORE UPDATE ON public.phone_allocations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX phone_allocations_user_idx ON public.phone_allocations(user_id);