ALTER TABLE public.sellers
  ADD COLUMN IF NOT EXISTS email_verification_last_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS email_verification_send_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS email_verification_window_start timestamptz;