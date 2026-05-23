-- ==========================================================================
-- VERIFIABILITY UPGRADE: Content hash + Mint tracking
-- Applied: 2026-02-23
-- Purpose: Add tamper-detection hashes to credit_ledger entries
--          and track on-chain mint status for deposits.
-- ==========================================================================

-- 1. Add content_hash column for tamper detection
-- Each ledger entry gets a SHA-256 hash of its canonical fields.
-- If someone modifies the row, the hash won't match the data.
ALTER TABLE public.credit_ledger
  ADD COLUMN IF NOT EXISTS content_hash TEXT;

-- 2. Add on-chain mint tracking for deposits
-- When a Paystack deposit occurs, we track whether the corresponding
-- SovereignCredit on-chain mint succeeded or is still pending.
ALTER TABLE public.credit_ledger
  ADD COLUMN IF NOT EXISTS on_chain_minted BOOLEAN DEFAULT FALSE;

ALTER TABLE public.credit_ledger
  ADD COLUMN IF NOT EXISTS mint_tx_hash TEXT;

-- 3. Add verification_method to audit_logs
-- Tracks HOW an action was verified (on-chain vs db-only)
ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS verification_method TEXT DEFAULT 'db-only';

ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS content_hash TEXT;

-- 4. Index for efficient hash lookups (tamper verification queries)
CREATE INDEX IF NOT EXISTS idx_credit_ledger_content_hash
  ON public.credit_ledger(content_hash);

-- 5. Index for finding unminted deposits (retry cron queries)
CREATE INDEX IF NOT EXISTS idx_credit_ledger_unminted
  ON public.credit_ledger(on_chain_minted) WHERE on_chain_minted = FALSE AND type = 'deposit';

COMMENT ON COLUMN public.credit_ledger.content_hash IS 'SHA-256 hash of canonical entry fields for tamper detection';
COMMENT ON COLUMN public.credit_ledger.on_chain_minted IS 'Whether this deposit has been minted on-chain as SovereignCredit tokens';
COMMENT ON COLUMN public.credit_ledger.mint_tx_hash IS 'On-chain transaction hash for the mint, if minted';
COMMENT ON COLUMN public.audit_logs.verification_method IS 'How this action was verified: on-chain, db-only, or signature';
COMMENT ON COLUMN public.audit_logs.content_hash IS 'SHA-256 hash of canonical log fields for tamper detection';
