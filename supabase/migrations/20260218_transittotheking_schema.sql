-- Migration: TRANSITTOTHEKING Phase 1 - Database Evolution
-- Date: 2026-02-18
-- Persona: DevOps Automator

BEGIN;

-- 1. Vault Simplification
-- Rename status to state to align with spec
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vaults' AND column_name = 'status') THEN
        ALTER TABLE vaults RENAME COLUMN status TO state;
    END IF;
END $$;

-- Update constraints for state (3 simplified states: active, releasing, released)
ALTER TABLE vaults DROP CONSTRAINT IF EXISTS vaults_status_check;
ALTER TABLE vaults DROP CONSTRAINT IF EXISTS vaults_state_check;
ALTER TABLE vaults ADD CONSTRAINT vaults_state_check 
  CHECK (state IN ('active', 'releasing', 'released'));

-- 2. People Consolidation (Email-Centric)
-- Ensure email is not null for heirs and guardians
-- (Table 'heirs' rename from 'beneficiaries' was handled in archive migrations)
ALTER TABLE heirs ALTER COLUMN email SET NOT NULL;
ALTER TABLE guardians ALTER COLUMN email SET NOT NULL;

-- 3. Credit System Implementation
-- Add financial plumbing to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS credits INTEGER DEFAULT 1000;
ALTER TABLE users ADD COLUMN IF NOT EXISTS pricing_tier TEXT DEFAULT 'Explorer';

-- Backfill existing users with starting balance
UPDATE users SET credits = 1000 WHERE credits IS NULL;
UPDATE users SET pricing_tier = 'Explorer' WHERE pricing_tier IS NULL;

-- Create credit_ledger table for financial auditability
-- user_id references public.users.privy_id (TEXT) for architectural consistency
CREATE TABLE IF NOT EXISTS credit_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT REFERENCES public.users(privy_id),
  amount INTEGER NOT NULL, -- positive for deposit, negative for usage
  description TEXT,
  type TEXT CHECK (type IN ('deposit', 'usage', 'bonus')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Optimize indexes for vault state lookups and credit checks
CREATE INDEX IF NOT EXISTS idx_vaults_state ON vaults(state);
CREATE INDEX IF NOT EXISTS idx_users_credits ON users(credits);
CREATE INDEX IF NOT EXISTS idx_credit_ledger_user_id ON credit_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_ledger_created_at ON credit_ledger(created_at);

-- 4. Constraints Enforcement
-- Dead Man's Switch intervals
ALTER TABLE vaults DROP CONSTRAINT IF EXISTS vaults_check_in_interval_check;
ALTER TABLE vaults ADD CONSTRAINT vaults_check_in_interval_check
  CHECK (check_in_interval_days IN (7, 14, 30, 90));

-- Shamir Secret Sharing presets
ALTER TABLE vaults DROP CONSTRAINT IF EXISTS vaults_sss_preset_check;
ALTER TABLE vaults ADD CONSTRAINT vaults_sss_preset_check
  CHECK (sss_preset IN ('standard', 'enhanced'));

COMMIT;
