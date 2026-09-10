ALTER TABLE public.companion_applications
  ADD COLUMN IF NOT EXISTS nir text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS housing_status text NOT NULL DEFAULT 'owner',
  ADD COLUMN IF NOT EXISTS address_proof_path text,
  ADD COLUMN IF NOT EXISTS host_attestation_path text,
  ADD COLUMN IF NOT EXISTS host_address_proof_path text,
  ADD COLUMN IF NOT EXISTS host_id_path text;