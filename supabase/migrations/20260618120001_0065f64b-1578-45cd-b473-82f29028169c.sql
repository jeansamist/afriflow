
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS kyc_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS kyc_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS kyc_rejection_reason text,
  ADD COLUMN IF NOT EXISTS kyc_doc_id_front text,
  ADD COLUMN IF NOT EXISTS kyc_doc_id_back text,
  ADD COLUMN IF NOT EXISTS kyc_doc_selfie text,
  ADD COLUMN IF NOT EXISTS kyc_doc_address text;
