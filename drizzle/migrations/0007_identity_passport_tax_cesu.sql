ALTER TYPE public.client_doc_type ADD VALUE IF NOT EXISTS 'identity_passport';
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tax_number text,
  ADD COLUMN IF NOT EXISTS has_cesu_number boolean,
  ADD COLUMN IF NOT EXISTS cesu_number text;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_tax_number_format CHECK (tax_number IS NULL OR tax_number ~ '^[0-9]{13}$');
COMMENT ON COLUMN public.profiles.tax_number IS 'Sensible : lisible uniquement par le titulaire et le mandataire (RLS).';
COMMENT ON COLUMN public.profiles.cesu_number IS 'Sensible : lisible uniquement par le titulaire et le mandataire (RLS).';
ALTER TABLE public.companion_applications
  ADD COLUMN IF NOT EXISTS id_type text,
  ADD COLUMN IF NOT EXISTS id_passport_path text,
  ADD COLUMN IF NOT EXISTS has_cesu_number boolean,
  ADD COLUMN IF NOT EXISTS cesu_number text;
ALTER TABLE public.companion_applications ADD CONSTRAINT companion_applications_id_type_check CHECK (id_type IS NULL OR id_type IN ('id_card','passport'));