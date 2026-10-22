-- PostgreSQL migration draft. Apply through a migration runner once the database is provisioned.
BEGIN;
CREATE TABLE users (
  id uuid PRIMARY KEY,
  email text NOT NULL CHECK (email = lower(email)),
  password_hash text NOT NULL,
  email_verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (email)
);
-- Account roles are granted server-side; signup must never assign administrator access.
CREATE TABLE user_roles (
  user_id uuid NOT NULL REFERENCES users(id),
  role text NOT NULL CHECK (role IN ('customer', 'vendor', 'admin')),
  PRIMARY KEY (user_id, role)
);
CREATE TABLE vendor_applications (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE REFERENCES users(id),
  business_name text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'changes_requested', 'approved', 'rejected', 'suspended')),
  reviewed_by uuid REFERENCES users(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE products (
  id uuid PRIMARY KEY,
  vendor_user_id uuid NOT NULL REFERENCES users(id),
  title text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'under_review', 'approved', 'paused', 'rejected')),
  UNIQUE (id, vendor_user_id)
);
CREATE TABLE product_variants (
  id uuid PRIMARY KEY,
  product_id uuid NOT NULL,
  vendor_user_id uuid NOT NULL,
  sku text NOT NULL,
  price_kobo bigint NOT NULL CHECK (price_kobo > 0 AND price_kobo <= 9007199254740991),
  stock_quantity integer NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  reserved_quantity integer NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0 AND reserved_quantity <= stock_quantity),
  FOREIGN KEY (product_id, vendor_user_id) REFERENCES products(id, vendor_user_id),
  UNIQUE (vendor_user_id, sku),
  UNIQUE (id, vendor_user_id)
);
CREATE TABLE order_requests (
  id uuid PRIMARY KEY,
  customer_id uuid NOT NULL REFERENCES users(id),
  vendor_id uuid NOT NULL REFERENCES users(id),
  product_variant_id uuid NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  state text NOT NULL DEFAULT 'draft' CHECK (state IN ('draft', 'checking_availability', 'reserved', 'awaiting_payment', 'confirmed', 'preparing', 'ready_for_dispatch', 'out_for_delivery', 'delivered', 'unavailable', 'cancelled')),
  version integer NOT NULL DEFAULT 0 CHECK (version >= 0),
  reservation_expires_at timestamptz,
  total_kobo bigint CHECK (total_kobo > 0 AND total_kobo <= 9007199254740991),
  accepted_total_kobo bigint,
  payment_verified boolean NOT NULL DEFAULT false,
  gift_details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (product_variant_id, vendor_id) REFERENCES product_variants(id, vendor_user_id),
  CHECK (accepted_total_kobo IS NULL OR accepted_total_kobo = total_kobo),
  CHECK (NOT payment_verified OR (total_kobo IS NOT NULL AND accepted_total_kobo IS NOT NULL AND accepted_total_kobo = total_kobo)),
  CHECK (state NOT IN ('confirmed','preparing','ready_for_dispatch','out_for_delivery','delivered') OR payment_verified)
);
CREATE TABLE payment_records (
  id uuid PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES order_requests(id),
  bank_reference text NOT NULL UNIQUE,
  received_kobo bigint NOT NULL CHECK (received_kobo > 0 AND received_kobo <= 9007199254740991),
  status text NOT NULL CHECK (status IN ('under_review', 'verified', 'discrepancy')),
  verified_by uuid REFERENCES users(id),
  verified_at timestamptz,
  CHECK (status <> 'verified' OR (verified_by IS NOT NULL AND verified_at IS NOT NULL))
);
CREATE TABLE order_events (
  id uuid PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES order_requests(id),
  actor_id uuid NOT NULL REFERENCES users(id),
  from_state text NOT NULL,
  to_state text NOT NULL,
  order_version integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id, order_version)
);
CREATE INDEX order_requests_customer_idx ON order_requests(customer_id, created_at);
CREATE INDEX order_requests_vendor_idx ON order_requests(vendor_id, state);
COMMIT;
