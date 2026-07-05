
-- 1) Prevent non-service_role updates to privileged profile columns (fixes privilege escalation)
CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_admin boolean := false;
BEGIN
  -- service_role bypasses (admin client server-side)
  IF current_setting('role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Allow admins as well
  IF auth.uid() IS NOT NULL THEN
    SELECT public.has_role(auth.uid(), 'admin'::app_role) INTO is_admin;
  END IF;
  IF is_admin THEN RETURN NEW; END IF;

  IF NEW.kyc_status IS DISTINCT FROM OLD.kyc_status
     OR NEW.is_frozen IS DISTINCT FROM OLD.is_frozen
     OR NEW.kyc_rejection_reason IS DISTINCT FROM OLD.kyc_rejection_reason
     OR NEW.kyc_reviewed_at IS DISTINCT FROM OLD.kyc_reviewed_at
     OR NEW.kyc_submitted_at IS DISTINCT FROM OLD.kyc_submitted_at
     OR NEW.kyc_doc_id_front IS DISTINCT FROM OLD.kyc_doc_id_front
     OR NEW.kyc_doc_id_back IS DISTINCT FROM OLD.kyc_doc_id_back
     OR NEW.kyc_doc_selfie IS DISTINCT FROM OLD.kyc_doc_selfie
     OR NEW.kyc_doc_address IS DISTINCT FROM OLD.kyc_doc_address
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.allocated_phone_number IS DISTINCT FROM OLD.allocated_phone_number
  THEN
    RAISE EXCEPTION 'Modification non autorisée d''un champ privilégié du profil';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_profile_privilege_escalation_trg ON public.profiles;
CREATE TRIGGER prevent_profile_privilege_escalation_trg
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_privilege_escalation();

-- 2) Grant admin role to the beta operator
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role FROM auth.users
WHERE email IN ('messiwilliam69@gmail.com', 'messiwilliam633@yahoo.fr')
ON CONFLICT (user_id, role) DO NOTHING;
