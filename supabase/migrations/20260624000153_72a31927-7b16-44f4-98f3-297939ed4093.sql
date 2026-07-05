
ALTER TABLE public.payouts ADD COLUMN IF NOT EXISTS admin_note text;

-- Admin SELECT/UPDATE policies for payouts (use existing has_role function)
DROP POLICY IF EXISTS "Admins can view all payouts" ON public.payouts;
CREATE POLICY "Admins can view all payouts" ON public.payouts FOR SELECT
  TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Admin column-grant on payouts for the fields they can edit
GRANT UPDATE (status, provider_reference, failure_reason, sent_at, admin_note, updated_at) ON public.payouts TO authenticated;

-- Allow admins to read all profiles (needed to display freelancer info)
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT
  TO authenticated USING (public.has_role(auth.uid(), 'admin'));
