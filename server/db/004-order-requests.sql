ALTER TABLE order_requests ADD COLUMN client_request_id uuid;
ALTER TABLE order_requests ADD COLUMN product_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE order_requests ADD COLUMN stock_held boolean NOT NULL DEFAULT false;
ALTER TABLE order_requests ADD CONSTRAINT order_request_retry_key UNIQUE(customer_id,client_request_id);
ALTER TABLE order_requests ADD CONSTRAINT held_stock_requires_expiry CHECK(NOT stock_held OR (reservation_expires_at IS NOT NULL AND state IN ('reserved','awaiting_payment')));
ALTER TABLE order_events ALTER COLUMN actor_id DROP NOT NULL;
ALTER TABLE order_events ADD COLUMN event_type text NOT NULL DEFAULT 'transition';
CREATE INDEX order_expiry_idx ON order_requests(product_variant_id,reservation_expires_at) WHERE stock_held;
