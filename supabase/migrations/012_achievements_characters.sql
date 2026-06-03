-- ─── Dynamic achievements defined via admin panel ────────────────────────────
CREATE TABLE IF NOT EXISTS achievements_config (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  description  TEXT NOT NULL,
  tier         TEXT NOT NULL CHECK (tier IN ('bronze','silver','gold','platinum','diamond','obsidian')),
  reward_type  TEXT NOT NULL CHECK (reward_type IN ('badge','title','character')),
  reward_value TEXT,           -- title string or character id (null for badge)
  condition    JSONB NOT NULL, -- { type, field/genres, value, minBooks, genreCount }
  sort_order   INTEGER DEFAULT 0,
  enabled      BOOLEAN DEFAULT true,
  created_at   TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE achievements_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone_read_achievements_config"
  ON achievements_config FOR SELECT USING (true);

CREATE POLICY "admin_manage_achievements_config"
  ON achievements_config FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- ─── Dynamic characters uploaded via admin panel ──────────────────────────────
CREATE TABLE IF NOT EXISTS characters_config (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  description       TEXT NOT NULL,
  default_primary   TEXT NOT NULL DEFAULT '#888888',
  default_secondary TEXT NOT NULL DEFAULT '#444444',
  glb_url           TEXT NOT NULL,
  enabled           BOOLEAN DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE characters_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone_read_characters_config"
  ON characters_config FOR SELECT USING (true);

CREATE POLICY "admin_manage_characters_config"
  ON characters_config FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- ─── Supabase Storage bucket for character GLB files ─────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('character-models', 'character-models', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "public_read_character_models"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'character-models');

CREATE POLICY "admin_upload_character_models"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'character-models' AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "admin_delete_character_models"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'character-models' AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );
