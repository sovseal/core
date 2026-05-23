-- TICKSAMID Phase 1: Grace Period & Hibernation
-- Author: backend-developer
-- Date: 2026-03-22

BEGIN;

-- 1. Add new columns to vaults table for grace period and hibernation
ALTER TABLE vaults ADD COLUMN IF NOT EXISTS credit_grace_started_at TIMESTAMPTZ;
ALTER TABLE vaults ADD COLUMN IF NOT EXISTS credit_deficit_cents INTEGER DEFAULT 0;
ALTER TABLE vaults ADD COLUMN IF NOT EXISTS hibernated_at TIMESTAMPTZ;

-- 2. Update vault state constraint to include 'hibernating'
ALTER TABLE vaults DROP CONSTRAINT IF EXISTS vaults_state_check;
ALTER TABLE vaults ADD CONSTRAINT vaults_state_check 
  CHECK (state IN ('active', 'releasing', 'released', 'hibernating'));

-- 3. Update existing index or ensure it exists for state
CREATE INDEX IF NOT EXISTS idx_vaults_state ON vaults(state);

COMMIT;
