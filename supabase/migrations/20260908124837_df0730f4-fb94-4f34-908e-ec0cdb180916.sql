-- Roles
CREATE TYPE public.app_role AS ENUM ('mandataire');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

CREATE POLICY "Users can view their own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- updated_at helper
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- Profiles
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  first_name text NOT NULL DEFAULT '',
  last_name text NOT NULL DEFAULT '',
  address_line text NOT NULL DEFAULT '',
  postal_code text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'mandataire'));
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Companion applications
CREATE TYPE public.application_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE public.companion_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  situation text NOT NULL DEFAULT '',
  school text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  motivation text NOT NULL DEFAULT '',
  selfie_path text,
  id_card_path text,
  situation_proof_path text,
  criminal_record_path text,
  iban_path text,
  status public.application_status NOT NULL DEFAULT 'pending',
  reject_reason text,
  reviewed_at timestamptz,
  reviewed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.companion_applications TO authenticated;
GRANT ALL ON public.companion_applications TO service_role;
ALTER TABLE public.companion_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Applicants and mandataire view applications" ON public.companion_applications FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'mandataire'));
CREATE POLICY "Applicants insert own application" ON public.companion_applications FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Applicants update own pending application" ON public.companion_applications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND status <> 'approved') WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Mandataire updates applications" ON public.companion_applications FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'mandataire')) WITH CHECK (public.has_role(auth.uid(), 'mandataire'));
CREATE TRIGGER companion_applications_updated_at BEFORE UPDATE ON public.companion_applications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage policies for the private "companion-docs" bucket (files stored under <user_id>/...)
CREATE POLICY "Applicants upload own docs" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'companion-docs' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Applicants update own docs" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'companion-docs' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Applicants and mandataire read docs" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'companion-docs' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(), 'mandataire')));