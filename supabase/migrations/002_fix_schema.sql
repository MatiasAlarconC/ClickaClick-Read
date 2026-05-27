-- Migration 002: Align books schema with app types
-- Run this in the Supabase SQL Editor

-- ─── books table ─────────────────────────────────────────────────────────────
ALTER TABLE books RENAME COLUMN google_id TO google_books_id;
ALTER TABLE books RENAME COLUMN page_count TO pages_default;
ALTER TABLE books RENAME COLUMN description TO synopsis;

-- Add missing columns
ALTER TABLE books ADD COLUMN IF NOT EXISTS open_library_id TEXT;
ALTER TABLE books ADD COLUMN IF NOT EXISTS published_year INTEGER;
ALTER TABLE books ADD COLUMN IF NOT EXISTS available_languages TEXT[] DEFAULT '{}';

-- Migrate text published → integer published_year where possible
UPDATE books
SET published_year = CAST(SUBSTRING(published FROM '^\d{4}') AS INTEGER)
WHERE published ~ '^\d{4}' AND published_year IS NULL;

-- Add UPDATE policy so upsert / edit works from the app
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'books' AND policyname = 'Authenticated users can update books'
  ) THEN
    EXECUTE 'CREATE POLICY "Authenticated users can update books" ON books FOR UPDATE USING (auth.uid() IS NOT NULL)';
  END IF;
END
$$;

-- ─── user_books table ────────────────────────────────────────────────────────
ALTER TABLE user_books ADD COLUMN IF NOT EXISTS custom_pages INTEGER;
ALTER TABLE user_books ADD COLUMN IF NOT EXISTS custom_language TEXT;
ALTER TABLE user_books ADD COLUMN IF NOT EXISTS added_at TIMESTAMPTZ DEFAULT NOW();

-- Back-fill added_at from created_at for existing rows
UPDATE user_books SET added_at = created_at WHERE added_at IS NULL;

-- ─── book_notes table ────────────────────────────────────────────────────────
ALTER TABLE book_notes RENAME COLUMN page_ref TO page_number;

-- ─── reading_sessions table ──────────────────────────────────────────────────
ALTER TABLE reading_sessions ADD COLUMN IF NOT EXISTS start_page INTEGER;
ALTER TABLE reading_sessions ADD COLUMN IF NOT EXISTS end_page INTEGER;
