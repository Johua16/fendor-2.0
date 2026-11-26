ALTER TABLE email_outbox ADD COLUMN priority smallint NOT NULL DEFAULT 50 CHECK(priority BETWEEN 0 AND 100);
ALTER TABLE email_outbox ADD COLUMN provider text;
ALTER TABLE email_outbox ADD COLUMN provider_message_id text;
ALTER TABLE email_outbox ADD COLUMN provider_status text;
ALTER TABLE email_outbox ADD COLUMN provider_status_at timestamptz;
ALTER TABLE email_outbox ADD COLUMN last_error_code text;
CREATE UNIQUE INDEX email_outbox_provider_message_idx ON email_outbox(provider,provider_message_id) WHERE provider IS NOT NULL AND provider_message_id IS NOT NULL;
CREATE INDEX email_outbox_pending_priority_idx ON email_outbox(priority DESC,next_attempt_at,created_at) WHERE sent_at IS NULL;
