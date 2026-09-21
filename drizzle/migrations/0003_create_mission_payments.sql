CREATE TABLE public.mission_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id text NOT NULL,
  client_id uuid NOT NULL,
  companion_user_id uuid,
  companion_ref text,
  stripe_setup_intent_id text,
  stripe_payment_method_id text,
  amount_cents integer NOT NULL DEFAULT 600,
  scheduled_charge_at timestamptz,
  status text NOT NULL DEFAULT 'en_attente_debit',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (mission_id)
);

GRANT SELECT, INSERT, UPDATE ON public.mission_payments TO authenticated;
GRANT ALL ON public.mission_payments TO service_role;

ALTER TABLE public.mission_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Client and companion view their mission payments"
ON public.mission_payments FOR SELECT TO authenticated
USING (auth.uid() = client_id OR auth.uid() = companion_user_id OR public.has_role(auth.uid(), 'mandataire'));

CREATE POLICY "Client inserts own mission payments"
ON public.mission_payments FOR INSERT TO authenticated
WITH CHECK (auth.uid() = client_id);

CREATE POLICY "Client and companion update their mission payments"
ON public.mission_payments FOR UPDATE TO authenticated
USING (auth.uid() = client_id OR auth.uid() = companion_user_id)
WITH CHECK (auth.uid() = client_id OR auth.uid() = companion_user_id);

CREATE TRIGGER mission_payments_updated_at
BEFORE UPDATE ON public.mission_payments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();