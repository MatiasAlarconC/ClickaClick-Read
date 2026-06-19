-- Stores per-user AI recommendation cache so recs sync across devices.
-- Replaces localStorage-only approach (device-specific).
CREATE TABLE IF NOT EXISTS user_recs_cache (
  user_id      UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  recs         JSONB          NOT NULL DEFAULT '[]',
  generated_at TIMESTAMPTZ    NOT NULL DEFAULT now()
);

ALTER TABLE user_recs_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own recs cache" ON user_recs_cache
  FOR ALL USING (auth.uid() = user_id);
