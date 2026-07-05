-- Add is_premium flag to profiles (granted automatically for waitlist members on signup)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_premium boolean NOT NULL DEFAULT false;

-- Protect is_premium from client-side escalation (same guard as other privileged columns)
CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_admin boolean := false;
BEGIN
  IF current_setting('role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;

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
     OR NEW.is_premium IS DISTINCT FROM OLD.is_premium
  THEN
    RAISE EXCEPTION 'Modification non autorisée d''un champ privilégié du profil';
  END IF;

  RETURN NEW;
END;
$$;
