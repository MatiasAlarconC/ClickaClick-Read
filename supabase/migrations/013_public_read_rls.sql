-- Migration 013: Ensure public read access for user_books and reading_sessions
-- Needed so friend profiles can display books and stats
-- Safe to run multiple times (DROP IF EXISTS + CREATE)

-- user_books: any authenticated user can read any shelf
DROP POLICY IF EXISTS "Books are publicly viewable" ON user_books;
CREATE POLICY "Books are publicly viewable" ON user_books
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- reading_sessions: any authenticated user can read session summaries
-- (needed to compute reading hours / stats on public profiles)
DROP POLICY IF EXISTS "Sessions are publicly viewable" ON reading_sessions;
CREATE POLICY "Sessions are publicly viewable" ON reading_sessions
  FOR SELECT USING (auth.uid() IS NOT NULL);
