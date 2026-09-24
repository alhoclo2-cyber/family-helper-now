ALTER TYPE public.client_doc_type ADD VALUE IF NOT EXISTS 'identity_front';
ALTER TYPE public.client_doc_type ADD VALUE IF NOT EXISTS 'identity_back';
ALTER TABLE public.companion_applications ADD COLUMN IF NOT EXISTS id_card_back_path text;
COMMENT ON COLUMN public.companion_applications.id_card_path IS 'Pièce d''identité — recto';