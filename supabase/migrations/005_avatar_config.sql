-- Migration 005: Avatar config for 3D character profile
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_config JSONB;
