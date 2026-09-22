ALTER TABLE public.mission_payments
  ADD COLUMN IF NOT EXISTS retry_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_retry_at timestamp with time zone;

CREATE INDEX IF NOT EXISTS mission_payments_next_retry_idx
  ON public.mission_payments (status, next_retry_at);