CREATE TABLE IF NOT EXISTS topic_desk (
  id uuid PRIMARY KEY,
  version integer NOT NULL DEFAULT 1,
  topic jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
