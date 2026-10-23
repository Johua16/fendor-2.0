CREATE TABLE payment_refunds (
 id uuid PRIMARY KEY,
 payment_id uuid NOT NULL REFERENCES payment_records(id),
 bank_reference text NOT NULL UNIQUE,
 amount_kobo bigint NOT NULL CHECK(amount_kobo>0 AND amount_kobo<=9007199254740991),
 recorded_by uuid NOT NULL REFERENCES users(id),
 note text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX payment_refunds_payment_idx ON payment_refunds(payment_id);

ALTER TABLE order_events ADD COLUMN review_note text;
