-- Migration: Final Audit Readiness - User Profile Columns
-- Date: 2026-03-06
-- Persona: DevOps Automator

BEGIN;

-- Add display_name and email columns to users table if they don't exist
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Create index for email search if needed
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);

COMMIT;
