CREATE TABLE order_quotes (
 id uuid PRIMARY KEY,
 order_id uuid NOT NULL REFERENCES order_requests(id),
 created_by uuid NOT NULL REFERENCES users(id),
 order_version integer NOT NULL,
 details jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(order_id,order_version)
);
ALTER TABLE order_requests ADD COLUMN quote_id uuid REFERENCES order_quotes(id);
ALTER TABLE order_requests ADD COLUMN accepted_quote_id uuid REFERENCES order_quotes(id);
ALTER TABLE payment_records ADD COLUMN received_by uuid REFERENCES users(id);
ALTER TABLE payment_records ADD COLUMN received_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE payment_records ADD COLUMN receipt_note text NOT NULL DEFAULT '';
CREATE INDEX payment_records_order_idx ON payment_records(order_id);
CREATE TABLE quote_acceptances (
 id uuid PRIMARY KEY,
 order_id uuid NOT NULL REFERENCES order_requests(id),
 quote_id uuid NOT NULL REFERENCES order_quotes(id),
 customer_id uuid NOT NULL REFERENCES users(id),
 total_kobo bigint NOT NULL CHECK(total_kobo>0),
 order_version integer NOT NULL,
 accepted_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(order_id,order_version)
);
