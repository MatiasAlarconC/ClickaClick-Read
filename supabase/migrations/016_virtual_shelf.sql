-- Add virtual shelf columns to user_books
ALTER TABLE user_books ADD COLUMN IF NOT EXISTS spine_url TEXT;
ALTER TABLE user_books ADD COLUMN IF NOT EXISTS shelf_pos JSONB;

-- Create book-spines storage bucket (public so cover images load without auth)
INSERT INTO storage.buckets (id, name, public)
VALUES ('book-spines', 'book-spines', true)
ON CONFLICT (id) DO NOTHING;

-- Users can upload into their own folder (path: <user_id>/<filename>)
CREATE POLICY "Users upload own spines"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'book-spines' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Anyone can read (public bucket, used in img src)
CREATE POLICY "Public read book spines"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'book-spines');

-- Users can overwrite their own uploads
CREATE POLICY "Users update own spines"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'book-spines' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can delete their own uploads
CREATE POLICY "Users delete own spines"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'book-spines' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );
