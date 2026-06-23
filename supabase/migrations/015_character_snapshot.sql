ALTER TABLE characters_config ADD COLUMN IF NOT EXISTS snapshot_url TEXT;

-- Allow admins to update existing objects in character-models storage bucket
CREATE POLICY "admin_update_character_models"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'character-models' AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );
