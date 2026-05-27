-- Migration 007: Extended reading goals
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS reading_goal_pages_per_day INTEGER;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS reading_goal_streak_days   INTEGER;
