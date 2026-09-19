CREATE TYPE public.client_doc_type AS ENUM ('rib', 'identity', 'proof_of_address');
CREATE TYPE public.client_doc_status AS ENUM ('missing', 'pending', 'validated', 'rejected');

CREATE TABLE public.client_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  doc_type public.client_doc_type NOT NULL,
  file_path text,
  status public.client_doc_status NOT NULL DEFAULT 'missing',
  reject_reason text,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, doc_type)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_documents TO authenticated;
GRANT ALL ON public.client_documents TO service_role;

ALTER TABLE public.client_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner and mandataire view client documents"
ON public.client_documents FOR SELECT TO authenticated
USING ((auth.uid() = user_id) OR public.has_role(auth.uid(), 'mandataire'));

CREATE POLICY "Owner inserts own client documents"
ON public.client_documents FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owner updates own client documents"
ON public.client_documents FOR UPDATE TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Mandataire updates client documents"
ON public.client_documents FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'mandataire'))
WITH CHECK (public.has_role(auth.uid(), 'mandataire'));
