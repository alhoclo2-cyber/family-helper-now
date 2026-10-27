CREATE TABLE public.mandataire_access_log (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 actor_id uuid NOT NULL,
 action text NOT NULL,
 object_type text NOT NULL,
 object_id text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.mandataire_access_log TO authenticated;
GRANT ALL ON public.mandataire_access_log TO service_role;
ALTER TABLE public.mandataire_access_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Mandataire reads access log" ON public.mandataire_access_log FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'mandataire'::public.app_role));
CREATE INDEX mandataire_access_log_created_idx ON public.mandataire_access_log (created_at DESC);
CREATE INDEX mandataire_access_log_object_idx ON public.mandataire_access_log (object_type, object_id);
