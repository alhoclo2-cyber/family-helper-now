-- Adresse complète du compagnon et pièce « carte Vitale »
ALTER TABLE public.companion_applications ADD COLUMN IF NOT EXISTS address text NOT NULL DEFAULT '';
ALTER TABLE public.companion_applications ADD COLUMN IF NOT EXISTS vitale_card_path text;
-- Ces champs ne sont plus demandés dans le formulaire
ALTER TABLE public.companion_applications ALTER COLUMN school DROP NOT NULL;
ALTER TABLE public.companion_applications ALTER COLUMN city DROP NOT NULL;