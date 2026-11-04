CREATE TABLE IF NOT EXISTS ingestion_status (
  id SMALLINT PRIMARY KEY CHECK (id = 1),
  last_attempt_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  last_error TEXT,
  locations_count INTEGER NOT NULL DEFAULT 0 CHECK (locations_count >= 0),
  readings_count INTEGER NOT NULL DEFAULT 0 CHECK (readings_count >= 0)
);

INSERT INTO ingestion_status (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;
