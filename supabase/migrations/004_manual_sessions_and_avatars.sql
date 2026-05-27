-- Migration 004: Manual reading sessions + avatar storage

-- ─── reading_sessions: flag manual page-update entries ───────────────────────
ALTER TABLE reading_sessions ADD COLUMN IF NOT EXISTS is_manual BOOLEAN DEFAULT FALSE;

-- ─── Supabase Storage: avatars bucket ────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload their own avatar
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage'
    AND policyname = 'Users can upload their own avatar'
  ) THEN
    EXECUTE $p$
      CREATE POLICY "Users can upload their own avatar"
      ON storage.objects FOR INSERT
      WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1])
    $p$;
  END IF;
END $$;

-- Allow anyone to read avatars (public bucket)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage'
    AND policyname = 'Avatars are publicly readable'
  ) THEN
    EXECUTE $p$
      CREATE POLICY "Avatars are publicly readable"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'avatars')
    $p$;
  END IF;
END $$;

-- Allow users to replace (update) their own avatar
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage'
    AND policyname = 'Users can update their own avatar'
  ) THEN
    EXECUTE $p$
      CREATE POLICY "Users can update their own avatar"
      ON storage.objects FOR UPDATE
      USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1])
    $p$;
  END IF;
END $$;
