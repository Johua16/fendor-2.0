CREATE TABLE payment_attempts (
  id uuid PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES order_requests(id),
  customer_id uuid NOT NULL REFERENCES users(id),
  provider text NOT NULL CHECK (provider IN ('paystack','flutterwave','paypal')),
  reference text NOT NULL UNIQUE,
  provider_payment_id text,
  amount_kobo bigint NOT NULL CHECK (amount_kobo > 0 AND amount_kobo <= 9007199254740991),
  provider_amount text NOT NULL DEFAULT '',
  provider_currency text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'initializing' CHECK (status IN ('initializing','pending','succeeded','failed','cancelled')),
  checkout_url text,
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX payment_attempts_order_idx ON payment_attempts(order_id, created_at DESC);
CREATE UNIQUE INDEX payment_attempts_provider_id_idx ON payment_attempts(provider,provider_payment_id) WHERE provider_payment_id IS NOT NULL;
ALTER TABLE payment_records ADD COLUMN provider text CHECK (provider IN ('paystack','flutterwave','paypal'));
ALTER TABLE payment_records ADD COLUMN provider_payment_id text;
CREATE UNIQUE INDEX payment_records_provider_id_idx ON payment_records(provider,provider_payment_id) WHERE provider_payment_id IS NOT NULL;
ALTER TABLE payment_records DROP CONSTRAINT payment_records_check;
ALTER TABLE payment_records ADD CONSTRAINT payment_records_verification_check CHECK (status <> 'verified' OR (verified_at IS NOT NULL AND (verified_by IS NOT NULL OR provider IS NOT NULL)));
