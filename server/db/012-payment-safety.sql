-- Stop rather than guessing which live attempt should remain active. The release
-- runbook contains the read-only preflight query and reconciliation procedure.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM payment_attempts
    WHERE status IN ('initializing', 'pending')
    GROUP BY order_id, provider
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Active duplicate payment attempts require reconciliation before migration 012';
  END IF;
END $$;

ALTER TABLE payment_attempts
  ADD COLUMN expires_at timestamptz,
  ADD COLUMN last_checked_at timestamptz;

UPDATE payment_attempts
SET expires_at = created_at + interval '30 minutes'
WHERE status IN ('initializing', 'pending') AND expires_at IS NULL;

CREATE UNIQUE INDEX payment_attempts_one_active_idx
  ON payment_attempts(order_id, provider)
  WHERE status IN ('initializing', 'pending');

CREATE TABLE payment_webhook_events (
  id uuid PRIMARY KEY,
  provider text NOT NULL CHECK (provider IN ('paystack','flutterwave','paypal')),
  event_key text NOT NULL,
  event_type text NOT NULL,
  reference text NOT NULL,
  provider_payment_id text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','processed','failed','ignored')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_error text,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  UNIQUE(provider, event_key)
);

CREATE INDEX payment_webhook_events_pending_idx
  ON payment_webhook_events(next_attempt_at, received_at)
  WHERE status IN ('pending','processing','failed');
