-- Migration 003: Add current_page to user_books
-- Run this in the Supabase SQL Editor

ALTER TABLE user_books ADD COLUMN IF NOT EXISTS current_page INTEGER;
