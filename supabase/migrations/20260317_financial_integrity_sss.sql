-- Migration: RUNRUNRUN Phase 2 — Financial Integrity + Key Share Storage
-- Date: 2026-03-17
-- Persona: backend-developer

BEGIN;

-- 1. Add encrypted_key to assets table
ALTER TABLE assets ADD COLUMN IF NOT EXISTS encrypted_key TEXT;

-- 2. Create guardian_key_shares table
CREATE TABLE IF NOT EXISTS guardian_key_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID REFERENCES assets(id) ON DELETE CASCADE,
  guardian_id UUID REFERENCES guardians(id) ON DELETE CASCADE,
  share_index INT NOT NULL,
  encrypted_share TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(asset_id, guardian_id)
);

-- Optimize indexes for share lookups
CREATE INDEX IF NOT EXISTS idx_guardian_key_shares_asset_id ON guardian_key_shares(asset_id);
CREATE INDEX IF NOT EXISTS idx_guardian_key_shares_guardian_id ON guardian_key_shares(guardian_id);

COMMIT;
