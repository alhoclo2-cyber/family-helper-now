ALTER TABLE public.mission_payments
  ADD COLUMN IF NOT EXISTS simulate_failure boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS charged_at timestamptz,
  ADD COLUMN IF NOT EXISTS failure_reason text,
  ADD COLUMN IF NOT EXISTS last_run_at timestamptz;

CREATE INDEX IF NOT EXISTS mission_payments_due_idx
  ON public.mission_payments (status, scheduled_charge_at);

DROP POLICY IF EXISTS "Mandataire updates mission payments" ON public.mission_payments;
CREATE POLICY "Mandataire updates mission payments"
  ON public.mission_payments FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'mandataire'::app_role))
  WITH CHECK (has_role(auth.uid(), 'mandataire'::app_role));