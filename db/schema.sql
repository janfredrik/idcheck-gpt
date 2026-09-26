CREATE TABLE IF NOT EXISTS attempts (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  phone_hash text NOT NULL,
  ip_hash text NOT NULL,
  outcome text NOT NULL CHECK (outcome IN ('started','rejected','verified','issued','expired','unknown')),
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
CREATE INDEX IF NOT EXISTS attempts_rate_idx ON attempts (tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS flow_sessions (
  token_hash text PRIMARY KEY,
  csrf_hash text NOT NULL,
  tenant_id uuid NOT NULL,
  user_id uuid NOT NULL,
  attempt_id uuid NOT NULL REFERENCES attempts(id),
  status text NOT NULL CHECK (status IN ('verified','issuing','issued','rejected','unknown','expired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS notification_outbox (
  id bigserial PRIMARY KEY,
  attempt_id uuid NOT NULL REFERENCES attempts(id),
  event_type text NOT NULL,
  recipient text NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sending','sent','failed')),
  attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  sent_at timestamptz
);
CREATE INDEX IF NOT EXISTS notification_outbox_queue_idx ON notification_outbox (status,next_attempt_at,id);
