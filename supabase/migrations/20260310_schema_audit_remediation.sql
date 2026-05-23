-- Migration: Schema Audit Remediation
-- Date: 2026-03-10
-- Persona: Security Auditor (adopting audit mindset)

BEGIN;

-- 1. Fix Vault check-in frequency constraint to support 'quarterly'
-- PostgreSQL doesn't allow direct ALTER of check constraints, we must drop and recreate
ALTER TABLE public.vaults DROP CONSTRAINT IF EXISTS vaults_check_in_frequency_check;
ALTER TABLE public.vaults ADD CONSTRAINT vaults_check_in_frequency_check 
    CHECK (check_in_frequency = ANY (ARRAY['daily'::text, 'weekly'::text, 'monthly'::text, 'quarterly'::text]));

-- 2. Expand User table to capture critical Alchemy Account Kit metadata for security
-- We focus ONLY on fields relevant to our security model (Auth Provider and IP tracking)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS auth_provider TEXT DEFAULT 'passkey';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_signin_ip TEXT;

-- 3. Update auth_type default to be more inclusive of Alchemy's multi-auth nature
ALTER TABLE public.users ALTER COLUMN auth_type SET DEFAULT 'social';

-- 4. Add index for faster wallet-email lookups during recovery flows
CREATE INDEX IF NOT EXISTS idx_users_wallet_email ON public.users(wallet_address, email);

COMMIT;
