-- ===== 1. user_roles + has_role (admin role system) =====
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read their own roles" ON public.user_roles;
CREATE POLICY "Users read their own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- ===== 2. in_app_notifications =====
CREATE TABLE IF NOT EXISTS public.in_app_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  title text NOT NULL,
  body text,
  link_to text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_in_app_notifications_user_unread
  ON public.in_app_notifications (user_id, read_at, created_at DESC);

GRANT SELECT, UPDATE ON public.in_app_notifications TO authenticated;
GRANT ALL ON public.in_app_notifications TO service_role;

ALTER TABLE public.in_app_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read their own notifications" ON public.in_app_notifications;
CREATE POLICY "Users read their own notifications"
  ON public.in_app_notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- Authenticated users may only flip read_at on their own notifications.
-- Column-level UPDATE keeps title/body/kind/metadata immutable from client.
REVOKE UPDATE ON public.in_app_notifications FROM authenticated;
GRANT UPDATE (read_at) ON public.in_app_notifications TO authenticated;

DROP POLICY IF EXISTS "Users mark their own notifications" ON public.in_app_notifications;
CREATE POLICY "Users mark their own notifications"
  ON public.in_app_notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ===== 3. Realtime publication =====
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.in_app_notifications;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;