ALTER TABLE public.mission_payments
  ADD COLUMN IF NOT EXISTS mission_at timestamptz,
  ADD COLUMN IF NOT EXISTS refund_status text NOT NULL DEFAULT 'aucun',
  ADD COLUMN IF NOT EXISTS refund_amount_cents integer,
  ADD COLUMN IF NOT EXISTS refund_reason text,
  ADD COLUMN IF NOT EXISTS refunded_at timestamptz,
  ADD COLUMN IF NOT EXISTS stripe_refund_id text;

ALTER TABLE public.mission_payments
  ADD CONSTRAINT mission_payments_refund_status_check
  CHECK (refund_status IN ('aucun','demande','rembourse','echec'));

-- Les champs de remboursement ne peuvent être modifiés que côté serveur (service role).
CREATE OR REPLACE FUNCTION public.protect_refund_fields()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    IF TG_OP = 'INSERT' THEN
      NEW.refund_status := 'aucun';
      NEW.refund_amount_cents := NULL;
      NEW.refund_reason := NULL;
      NEW.refunded_at := NULL;
      NEW.stripe_refund_id := NULL;
    ELSIF NEW.refund_status IS DISTINCT FROM OLD.refund_status
       OR NEW.refund_amount_cents IS DISTINCT FROM OLD.refund_amount_cents
       OR NEW.refund_reason IS DISTINCT FROM OLD.refund_reason
       OR NEW.refunded_at IS DISTINCT FROM OLD.refunded_at
       OR NEW.stripe_refund_id IS DISTINCT FROM OLD.stripe_refund_id THEN
      RAISE EXCEPTION 'Modification du remboursement non autorisée';
    END IF;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER mission_payments_protect_refund
BEFORE INSERT OR UPDATE ON public.mission_payments
FOR EACH ROW EXECUTE FUNCTION public.protect_refund_fields();