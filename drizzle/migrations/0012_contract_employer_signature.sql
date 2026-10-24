CREATE TABLE public.contract_signature_codes (
  contract_id uuid PRIMARY KEY REFERENCES public.work_contracts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.contract_signature_codes TO service_role;
ALTER TABLE public.contract_signature_codes ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.contract_signature_codes IS 'Codes à usage unique de signature (empreinte seulement), accessibles au seul service_role.';

CREATE OR REPLACE FUNCTION public.sign_contract_employer(
  _contract_id uuid, _client_id uuid, _snapshot jsonb, _hash text, _deadline timestamptz,
  _companion_user_id uuid, _first_mission_id text, _contract_kind text,
  _effective_from date, _effective_until date
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.work_contracts;
BEGIN
  SELECT * INTO r FROM public.work_contracts WHERE id = _contract_id FOR UPDATE;
  IF NOT FOUND OR r.client_id <> _client_id THEN RAISE EXCEPTION 'not_owner'; END IF;
  IF r.status <> 'draft' THEN RAISE EXCEPTION 'not_draft'; END IF;
  IF EXISTS (SELECT 1 FROM public.work_contracts w WHERE w.client_id = r.client_id AND w.companion_ref = r.companion_ref
             AND w.id <> r.id AND w.status IN ('draft','awaiting_companion','in_force')) THEN
    RAISE EXCEPTION 'pair_active';
  END IF;
  UPDATE public.work_contracts SET
    status = 'awaiting_companion', contract_kind = _contract_kind, contract_snapshot = _snapshot, document_hash = _hash,
    employer_signed_at = now(), companion_answer_deadline = _deadline, companion_user_id = _companion_user_id,
    first_mission_id = _first_mission_id, effective_from = _effective_from, effective_until = _effective_until
  WHERE id = _contract_id;
  INSERT INTO public.contract_signature_log (contract_id, event, actor_id, actor_role, document_hash, auth_method, occurred_at)
  VALUES (_contract_id, 'employer_signed', _client_id, 'family', _hash, 'email_otp', now());
  DELETE FROM public.contract_signature_codes WHERE contract_id = _contract_id;
END $$;
REVOKE ALL ON FUNCTION public.sign_contract_employer(uuid, uuid, jsonb, text, timestamptz, uuid, text, text, date, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sign_contract_employer(uuid, uuid, jsonb, text, timestamptz, uuid, text, text, date, date) TO service_role;