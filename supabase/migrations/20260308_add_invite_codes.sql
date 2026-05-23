-- Migration: Heir and Guardian Invite Codes
-- Date: 2026-03-08
-- Persona: DevOps Automator

BEGIN;

-- Add invite_code to heirs
ALTER TABLE heirs ADD COLUMN IF NOT EXISTS invite_code TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_heirs_invite_code ON heirs(invite_code);

-- Add invite_code to guardians
ALTER TABLE guardians ADD COLUMN IF NOT EXISTS invite_code TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_guardians_invite_code ON guardians(invite_code);

COMMIT;
