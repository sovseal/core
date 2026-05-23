-- Migration: Final Audit Readiness - Settings Persistence
-- Date: 2026-03-06
-- Persona: DevOps Automator

BEGIN;

-- Add settings column to users table if it doesn't exist
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{
  "notifications": {
    "email": true,
    "security": true,
    "marketing": false
  },
  "theme": "dark",
  "currency": "USD"
}'::jsonb;

-- Ensure JSONB GIN index for faster search if we ever need it (optional but good practice)
CREATE INDEX IF NOT EXISTS idx_users_settings ON public.users USING GIN (settings);

COMMIT;
