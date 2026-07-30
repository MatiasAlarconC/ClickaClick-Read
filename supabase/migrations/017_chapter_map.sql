ALTER TABLE user_books ADD COLUMN IF NOT EXISTS chapter_map JSONB;
ALTER TABLE reading_sessions ADD COLUMN IF NOT EXISTS chapter_label TEXT;
ALTER TABLE reading_sessions ADD COLUMN IF NOT EXISTS chapter_position TEXT;
