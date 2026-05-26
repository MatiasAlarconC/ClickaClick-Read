-- ClickaClick Supabase Migration
-- Run this in the Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── profiles ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id                              UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username                        TEXT,
  avatar_url                      TEXT,
  reading_goal_books_per_year     INTEGER DEFAULT 12,
  reading_goal_minutes_per_day    INTEGER DEFAULT 30,
  is_admin                        BOOLEAN DEFAULT false,
  created_at                      TIMESTAMPTZ DEFAULT NOW(),
  updated_at                      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- ─── books ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS books (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  google_id   TEXT UNIQUE,
  title       TEXT NOT NULL,
  author      TEXT,
  description TEXT,
  cover_url   TEXT,
  page_count  INTEGER,
  language    TEXT,
  genres      TEXT[] DEFAULT '{}',
  published   TEXT,
  isbn        TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE books ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Books are publicly readable" ON books FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert books" ON books FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ─── user_books ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_books (
  id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  book_id       UUID REFERENCES books(id) ON DELETE CASCADE NOT NULL,
  status        TEXT NOT NULL CHECK (status IN ('reading','finished','want_to_read')),
  user_rating   INTEGER CHECK (user_rating BETWEEN 1 AND 5),
  current_page  INTEGER DEFAULT 0,
  started_at    TIMESTAMPTZ,
  finished_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, book_id)
);

ALTER TABLE user_books ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own user_books" ON user_books FOR ALL USING (auth.uid() = user_id);

-- ─── reading_sessions ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reading_sessions (
  id               UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id          UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  book_id          UUID REFERENCES books(id) ON DELETE CASCADE NOT NULL,
  started_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at         TIMESTAMPTZ,
  duration_seconds INTEGER DEFAULT 0,
  pages_read       INTEGER DEFAULT 0,
  note             TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE reading_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own sessions" ON reading_sessions FOR ALL USING (auth.uid() = user_id);

-- ─── book_notes ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS book_notes (
  id         UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  book_id    UUID REFERENCES books(id) ON DELETE CASCADE NOT NULL,
  content    TEXT NOT NULL,
  page_ref   INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE book_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own notes" ON book_notes FOR ALL USING (auth.uid() = user_id);

-- ─── admin_config ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_config (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE admin_config ENABLE ROW LEVEL SECURITY;
-- Only admins and service role can write; everyone can read (features check)
CREATE POLICY "Anyone can read config" ON admin_config FOR SELECT USING (true);
CREATE POLICY "Only admins can write config" ON admin_config FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- Default AI config values
INSERT INTO admin_config (key, value) VALUES
  ('gemini_enabled', 'true'),
  ('gemini_model', 'gemini-1.5-flash'),
  ('gemini_summary_enabled', 'true'),
  ('gemini_recommendations_enabled', 'true'),
  ('gemini_wrapped_enabled', 'true'),
  ('monthly_token_budget', '500000')
ON CONFLICT (key) DO NOTHING;

-- ─── ai_usage_log ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_usage_log (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  feature     TEXT NOT NULL,
  tokens_used INTEGER NOT NULL DEFAULT 0,
  model       TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE ai_usage_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can read ai_usage_log" ON ai_usage_log FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));
CREATE POLICY "Service role can insert ai_usage_log" ON ai_usage_log FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ─── ai_summary_cache ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_summary_cache (
  id         UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  book_id    UUID REFERENCES books(id) ON DELETE CASCADE NOT NULL,
  summary    TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, book_id)
);

ALTER TABLE ai_summary_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own summary cache" ON ai_summary_cache FOR ALL USING (auth.uid() = user_id);

-- ─── Indexes ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_user_books_user_id ON user_books(user_id);
CREATE INDEX IF NOT EXISTS idx_user_books_status ON user_books(user_id, status);
CREATE INDEX IF NOT EXISTS idx_reading_sessions_user_id ON reading_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_reading_sessions_started_at ON reading_sessions(user_id, started_at);
CREATE INDEX IF NOT EXISTS idx_book_notes_user_id ON book_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_books_google_id ON books(google_id);
