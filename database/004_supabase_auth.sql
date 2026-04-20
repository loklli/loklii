-- Migration: Switch to Supabase Auth as identity provider
-- Run this in Supabase SQL Editor before deploying

-- password_hash is no longer needed (Supabase Auth manages passwords)
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE users ALTER COLUMN password_hash SET DEFAULT NULL;

-- recovery_codes no longer needed (Supabase Auth handles password recovery)
-- Leaving column in place to avoid breaking existing rows

-- Mark all existing users as verified (they were created pre-migration)
UPDATE users SET is_verified = true WHERE is_verified = false;
