ALTER TABLE public.profiles ADD COLUMN birth_name text NOT NULL DEFAULT '';
COMMENT ON COLUMN public.profiles.last_name IS 'Nom d’usage';
COMMENT ON COLUMN public.profiles.birth_name IS 'Nom de naissance';

CREATE TABLE public.app_settings (
 key text PRIMARY KEY, value jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now(), updated_by uuid
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read settings" ON public.app_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Mandataire inserts settings" ON public.app_settings FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'mandataire'));
CREATE POLICY "Mandataire updates settings" ON public.app_settings FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'mandataire')) WITH CHECK (public.has_role(auth.uid(), 'mandataire'));
CREATE POLICY "Mandataire deletes settings" ON public.app_settings FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'mandataire'));
CREATE TRIGGER app_settings_updated_at BEFORE UPDATE ON public.app_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.work_contracts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), client_id uuid NOT NULL,
 companion_user_id uuid, companion_ref text NOT NULL,
 status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','awaiting_companion','in_force','refused','expired','ended')),
 contract_kind text CHECK (contract_kind IN ('cdi','cdd')),
 answers jsonb NOT NULL DEFAULT '{}', contract_snapshot jsonb, document_hash text, pdf_path text,
 employer_signed_at timestamptz, companion_signed_at timestamptz, companion_answer_deadline timestamptz, refused_at timestamptz,
 effective_from date, effective_until date, first_mission_id text,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.work_contracts TO authenticated;
GRANT ALL ON public.work_contracts TO service_role;
ALTER TABLE public.work_contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Parties and mandataire read contracts" ON public.work_contracts FOR SELECT TO authenticated USING (client_id = auth.uid() OR (companion_user_id = auth.uid() AND status <> 'draft') OR public.has_role(auth.uid(), 'mandataire'));
CREATE POLICY "Client inserts draft contracts" ON public.work_contracts FOR INSERT TO authenticated WITH CHECK (client_id = auth.uid() AND status = 'draft');
CREATE POLICY "Client updates draft contracts" ON public.work_contracts FOR UPDATE TO authenticated USING (client_id = auth.uid() AND status = 'draft') WITH CHECK (client_id = auth.uid() AND status = 'draft');
CREATE UNIQUE INDEX work_contracts_one_active_pair ON public.work_contracts (client_id, companion_ref) WHERE status IN ('draft','awaiting_companion','in_force');
CREATE TRIGGER work_contracts_updated_at BEFORE UPDATE ON public.work_contracts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.contract_signature_log (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), contract_id uuid NOT NULL REFERENCES public.work_contracts(id) ON DELETE RESTRICT,
 event text NOT NULL CHECK (event IN ('employer_signed','companion_signed','companion_refused','timeout')),
 actor_id uuid, actor_role text CHECK (actor_role IN ('family','companion','system')),
 document_hash text, auth_method text, metadata jsonb NOT NULL DEFAULT '{}', occurred_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.contract_signature_log TO authenticated;
GRANT ALL ON public.contract_signature_log TO service_role;
ALTER TABLE public.contract_signature_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Parties and mandataire read signature log" ON public.contract_signature_log FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'mandataire') OR EXISTS (SELECT 1 FROM public.work_contracts c WHERE c.id = contract_id AND (c.client_id = auth.uid() OR c.companion_user_id = auth.uid())));