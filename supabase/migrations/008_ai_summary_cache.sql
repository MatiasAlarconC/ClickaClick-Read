-- Migration 008: AI summary cache table
CREATE TABLE IF NOT EXISTS ai_summary_cache (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_title  TEXT NOT NULL,
  page_range  INTEGER NOT NULL,
  summary     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, book_title, page_range)
);

CREATE INDEX IF NOT EXISTS ai_summary_cache_lookup
  ON ai_summary_cache (user_id, book_title, page_range, created_at DESC);

ALTER TABLE ai_summary_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own summaries"
  ON ai_summary_cache FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Enable all Gemini features in admin_config
INSERT INTO admin_config (key, value) VALUES
  ('gemini_enabled',                 'true'),
  ('gemini_model',                   'gemini-2.5-flash'),
  ('gemini_summary_enabled',         'true'),
  ('gemini_recommendations_enabled', 'true'),
  ('gemini_wrapped_enabled',         'true'),
  ('monthly_token_budget',           '1000000')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
