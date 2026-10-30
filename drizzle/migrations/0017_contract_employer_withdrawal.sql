ALTER TABLE public.work_contracts DROP CONSTRAINT work_contracts_status_check;
ALTER TABLE public.work_contracts ADD CONSTRAINT work_contracts_status_check CHECK (status IN ('draft','awaiting_companion','in_force','refused','expired','ended','withdrawn'));
ALTER TABLE public.contract_signature_log DROP CONSTRAINT contract_signature_log_event_check;
ALTER TABLE public.contract_signature_log ADD CONSTRAINT contract_signature_log_event_check CHECK (event IN ('employer_signed','companion_signed','companion_refused','timeout','contract_finalized','contract_emailed','employer_withdrawn'));
CREATE OR REPLACE FUNCTION public.withdraw_contract_employer(_contract_id uuid, _client_id uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.work_contracts;
BEGIN
 SELECT * INTO r FROM public.work_contracts WHERE id = _contract_id FOR UPDATE;
 IF NOT FOUND OR r.client_id IS DISTINCT FROM _client_id THEN RAISE EXCEPTION 'not_owner'; END IF;
 IF r.status <> 'awaiting_companion' OR r.companion_signed_at IS NOT NULL THEN RAISE EXCEPTION 'already_answered'; END IF;
 UPDATE public.work_contracts SET status = 'withdrawn' WHERE id = _contract_id;
 DELETE FROM public.contract_signature_codes WHERE contract_id = _contract_id;
 UPDATE public.mission_payments SET status = 'annulee_avant_debit', scheduled_charge_at = NULL, next_retry_at = NULL WHERE mission_id = r.first_mission_id AND client_id = _client_id;
 INSERT INTO public.contract_signature_log(contract_id,event,actor_id,actor_role,document_hash,occurred_at) VALUES (_contract_id,'employer_withdrawn',_client_id,'family',r.document_hash,now());
 RETURN r.first_mission_id;
END $$;
REVOKE ALL ON FUNCTION public.withdraw_contract_employer(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.withdraw_contract_employer(uuid,uuid) TO service_role;
COMMENT ON FUNCTION public.withdraw_contract_employer(uuid,uuid) IS 'Atomic owner withdrawal and simulated payment cancellation. The linked browser-memory mission is reconciled from withdrawn status; active-pair partial index excludes withdrawn.';