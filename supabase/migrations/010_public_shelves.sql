-- Migration 010: Make reading shelves publicly viewable
-- This allows friends (and any authenticated user) to see what others are reading.

-- user_books: allow any authenticated user to read others' shelves
DROP POLICY IF EXISTS "Books are publicly viewable" ON user_books;
CREATE POLICY "Books are publicly viewable" ON user_books
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- reading_sessions: allow any authenticated user to read session summaries
-- (needed to compute reading hours / stats for public profiles)
DROP POLICY IF EXISTS "Sessions are publicly viewable" ON reading_sessions;
CREATE POLICY "Sessions are publicly viewable" ON reading_sessions
  FOR SELECT USING (auth.uid() IS NOT NULL);
