-- Migration 006: Add title column to profiles for achievement rewards
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS title TEXT;
