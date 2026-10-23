ALTER TABLE users ADD COLUMN full_name text NOT NULL DEFAULT '';
ALTER TABLE vendor_applications ADD COLUMN country text NOT NULL DEFAULT 'NG';
ALTER TABLE vendor_applications ADD COLUMN business_location text NOT NULL DEFAULT '';
ALTER TABLE vendor_applications ADD COLUMN registration_number text NOT NULL DEFAULT '';
ALTER TABLE vendor_applications ADD COLUMN review_note text;
CREATE TABLE sessions (
 token_hash text PRIMARY KEY,
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 expires_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user_idx ON sessions(user_id);
CREATE TABLE identity_tokens (
 token_hash text PRIMARY KEY,
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 purpose text NOT NULL CHECK (purpose IN ('verify','reset')),
 expires_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX identity_tokens_user_idx ON identity_tokens(user_id, purpose);
CREATE TABLE auth_limits (
 bucket text PRIMARY KEY,
 count integer NOT NULL,
 expires_at timestamptz NOT NULL
);
CREATE TABLE email_outbox (
 id uuid PRIMARY KEY,
 payload text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 sent_at timestamptz,
 attempts integer NOT NULL DEFAULT 0
);
CREATE TABLE vendor_review_events (
 id uuid PRIMARY KEY,
 application_id uuid NOT NULL REFERENCES vendor_applications(id),
 actor_id uuid NOT NULL REFERENCES users(id),
 from_status text NOT NULL,
 to_status text NOT NULL,
 note text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
