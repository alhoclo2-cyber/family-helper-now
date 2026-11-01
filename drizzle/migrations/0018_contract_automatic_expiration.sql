CREATE TABLE public.contract_expiration_emails (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 contract_id uuid NOT NULL REFERENCES public.work_contracts(id),
 user_id uuid NOT NULL,
 recipient_role text NOT NULL CHECK (recipient_role IN ('family','companion')),
 subject text NOT NULL,
 body text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (contract_id, recipient_role)
);
GRANT SELECT ON public.contract_expiration_emails TO authenticated;
GRANT ALL ON public.contract_expiration_emails TO service_role;
ALTER TABLE public.contract_expiration_emails ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Recipient reads simulated expiration emails" ON public.contract_expiration_emails FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE OR REPLACE FUNCTION public.expire_overdue_contracts()
RETURNS SETOF uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE r public.work_contracts;
BEGIN
 FOR r IN
  UPDATE public.work_contracts SET status = 'expired'
  WHERE status = 'awaiting_companion' AND companion_signed_at IS NULL AND companion_answer_deadline < now()
  RETURNING *
 LOOP
  DELETE FROM public.contract_signature_codes WHERE contract_id = r.id;
  INSERT INTO public.contract_signature_log(contract_id,event,actor_id,actor_role,occurred_at)
  VALUES(r.id,'expired',NULL,'system',now());
  INSERT INTO public.contract_expiration_emails(contract_id,user_id,recipient_role,subject,body)
  VALUES(r.id,r.client_id,'family','Le délai de réponse est dépassé, le contrat a expiré','Le délai de réponse est dépassé, le contrat a expiré. Vous pouvez choisir un autre compagnon pour cette mission ou refaire votre demande.')
  ON CONFLICT(contract_id,recipient_role) DO NOTHING;
  IF r.companion_user_id IS NOT NULL THEN
   INSERT INTO public.contract_expiration_emails(contract_id,user_id,recipient_role,subject,body)
   VALUES(r.id,r.companion_user_id,'companion','Le délai de réponse est dépassé, le contrat a expiré','Le délai de réponse est dépassé, le contrat a expiré. Vous n’avez plus à répondre à cette proposition.')
   ON CONFLICT(contract_id,recipient_role) DO NOTHING;
  END IF;
  UPDATE public.mission_payments SET status='annulee_avant_debit',scheduled_charge_at=NULL,next_retry_at=NULL
  WHERE mission_id=r.first_mission_id AND client_id=r.client_id AND status IN ('en_attente_debit','echec_debit');
  RETURN NEXT r.id;
 END LOOP;
END $function$;
REVOKE EXECUTE ON FUNCTION public.expire_overdue_contracts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_overdue_contracts() TO service_role;