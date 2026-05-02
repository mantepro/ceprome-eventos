-- Add 'refunded' to registrations.status CHECK constraint
ALTER TABLE public.registrations
  DROP CONSTRAINT IF EXISTS registrations_status_check;

ALTER TABLE public.registrations
  ADD CONSTRAINT registrations_status_check
  CHECK (status IN ('draft','pending','paid','cancelled','refunded'));

-- Add 'refunded' to scan_logs.result CHECK constraint
ALTER TABLE public.scan_logs
  DROP CONSTRAINT IF EXISTS scan_logs_result_check;

ALTER TABLE public.scan_logs
  ADD CONSTRAINT scan_logs_result_check
  CHECK (result IN ('valid','valid_pending_payment','already_used','pending_payment','cancelled','not_found','refunded'));
