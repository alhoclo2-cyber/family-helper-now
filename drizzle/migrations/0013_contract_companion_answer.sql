ALTER TABLE public.work_contracts
  ADD COLUMN final_document jsonb,
  ADD COLUMN final_document_hash text,
  ADD COLUMN finalized_at timestamptz;

ALTER TABLE public.contract_signature_log DROP CONSTRAINT IF EXISTS contract_signature_log_event_check;
ALTER TABLE public.contract_signature_log ADD CONSTRAINT contract_signature_log_event_check
  CHECK (event IN ('employer_signed','companion_signed','companion_refused','timeout','contract_finalized','contract_emailed'));

CREATE OR REPLACE FUNCTION public.sign_contract_companion(
  _contract_id uuid, _companion_user_id uuid, _final_document jsonb, _final_hash text, _recomputed_hash text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.work_contracts;
BEGIN
  SELECT * INTO r FROM public.work_contracts WHERE id = _contract_id FOR UPDATE;
  IF NOT FOUND OR r.companion_user_id IS DISTINCT FROM _companion_user_id THEN RAISE EXCEPTION 'not_companion'; END IF;
  IF r.status <> 'awaiting_companion' THEN RAISE EXCEPTION 'not_awaiting'; END IF;
  IF r.companion_answer_deadline IS NULL OR r.companion_answer_deadline < now() THEN RAISE EXCEPTION 'expired'; END IF;
  IF r.document_hash IS NULL OR r.document_hash <> _recomputed_hash THEN RAISE EXCEPTION 'hash_mismatch'; END IF;
  UPDATE public.work_contracts SET
    status = 'in_force', companion_signed_at = now(),
    final_document = _final_document, final_document_hash = _final_hash, finalized_at = now()
  WHERE id = _contract_id;
  INSERT INTO public.contract_signature_log (contract_id, event, actor_id, actor_role, document_hash, auth_method, occurred_at)
  VALUES (_contract_id, 'companion_signed', _companion_user_id, 'companion', _recomputed_hash, 'email_otp', now());
  INSERT INTO public.contract_signature_log (contract_id, event, actor_id, actor_role, document_hash, auth_method, occurred_at)
  VALUES (_contract_id, 'contract_finalized', _companion_user_id, 'system', _final_hash, 'email_otp', now());
  DELETE FROM public.contract_signature_codes WHERE contract_id = _contract_id;
END $$;
REVOKE ALL ON FUNCTION public.sign_contract_companion(uuid, uuid, jsonb, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sign_contract_companion(uuid, uuid, jsonb, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.refuse_contract_companion(_contract_id uuid, _companion_user_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.work_contracts;
BEGIN
  SELECT * INTO r FROM public.work_contracts WHERE id = _contract_id FOR UPDATE;
  IF NOT FOUND OR r.companion_user_id IS DISTINCT FROM _companion_user_id THEN RAISE EXCEPTION 'not_companion'; END IF;
  IF r.status <> 'awaiting_companion' THEN RAISE EXCEPTION 'not_awaiting'; END IF;
  IF r.companion_answer_deadline IS NULL OR r.companion_answer_deadline < now() THEN RAISE EXCEPTION 'expired'; END IF;
  UPDATE public.work_contracts SET status = 'refused', refused_at = now() WHERE id = _contract_id;
  INSERT INTO public.contract_signature_log (contract_id, event, actor_id, actor_role, occurred_at)
  VALUES (_contract_id, 'companion_refused', _companion_user_id, 'companion', now());
  DELETE FROM public.contract_signature_codes WHERE contract_id = _contract_id;
END $$;
REVOKE ALL ON FUNCTION public.refuse_contract_companion(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refuse_contract_companion(uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.expire_overdue_contracts() RETURNS SETOF uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.work_contracts;
BEGIN
  FOR r IN
    UPDATE public.work_contracts SET status = 'expired'
    WHERE status = 'awaiting_companion' AND companion_answer_deadline < now()
    RETURNING *
  LOOP
    INSERT INTO public.contract_signature_log (contract_id, event, actor_id, actor_role, occurred_at)
    VALUES (r.id, 'timeout', NULL, 'system', now());
    DELETE FROM public.contract_signature_codes WHERE contract_id = r.id;
    RETURN NEXT r.id;
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.expire_overdue_contracts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_overdue_contracts() TO service_role;

CREATE OR REPLACE FUNCTION public.simulate_companion_answer(
  _contract_id uuid, _client_id uuid, _action text, _final_document jsonb, _final_hash text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.work_contracts;
BEGIN
  SELECT * INTO r FROM public.work_contracts WHERE id = _contract_id FOR UPDATE;
  IF NOT FOUND OR r.client_id <> _client_id THEN RAISE EXCEPTION 'not_owner'; END IF;
  IF r.companion_ref ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN RAISE EXCEPTION 'not_demo'; END IF;
  IF r.status <> 'awaiting_companion' THEN RAISE EXCEPTION 'not_awaiting'; END IF;
  IF _action = 'accept' THEN
    UPDATE public.work_contracts SET
      status = 'in_force', companion_signed_at = now(),
      final_document = _final_document, final_document_hash = _final_hash, finalized_at = now()
    WHERE id = _contract_id;
    INSERT INTO public.contract_signature_log (contract_id, event, actor_id, actor_role, document_hash, auth_method, metadata, occurred_at)
    VALUES (_contract_id, 'companion_signed', NULL, 'companion', r.document_hash, 'email_otp', '{"simulated": true}', now());
    INSERT INTO public.contract_signature_log (contract_id, event, actor_id, actor_role, document_hash, auth_method, metadata, occurred_at)
    VALUES (_contract_id, 'contract_finalized', NULL, 'system', _final_hash, 'email_otp', '{"simulated": true}', now());
  ELSIF _action = 'refuse' THEN
    UPDATE public.work_contracts SET status = 'refused', refused_at = now() WHERE id = _contract_id;
    INSERT INTO public.contract_signature_log (contract_id, event, actor_id, actor_role, metadata, occurred_at)
    VALUES (_contract_id, 'companion_refused', NULL, 'companion', '{"simulated": true}', now());
  ELSIF _action = 'timeout' THEN
    UPDATE public.work_contracts SET status = 'expired' WHERE id = _contract_id;
    INSERT INTO public.contract_signature_log (contract_id, event, actor_id, actor_role, metadata, occurred_at)
    VALUES (_contract_id, 'timeout', NULL, 'system', '{"simulated": true}', now());
  ELSE
    RAISE EXCEPTION 'bad_action';
  END IF;
  DELETE FROM public.contract_signature_codes WHERE contract_id = _contract_id;
END $$;
REVOKE ALL ON FUNCTION public.simulate_companion_answer(uuid, uuid, text, jsonb, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.simulate_companion_answer(uuid, uuid, text, jsonb, text) TO service_role;