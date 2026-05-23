-- ==========================================================================
-- VERIFIABILITY UPGRADE: Immutable Audit Chain (Phase 2)
-- Applied: 2026-02-24
-- Purpose: Link audit logs into a chronological chain via previous_hash.
-- ==========================================================================

-- 1. Add previous_hash column to audit_logs
-- This column stores the content_hash of the chronologically preceding entry
-- for the same user.
ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS previous_hash TEXT;

-- 2. Index for chain verification performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_previous_hash
  ON public.audit_logs(previous_hash);

-- 3. Backfill attempt (optional/conservative)
-- Since we just added content_hash in P1, most old entries will have NULL hashes.
-- But for entries with hashes, we could theoretically link them.
-- For this mission, we assume the chain starts from the first entry AFTER this upgrade.

COMMENT ON COLUMN public.audit_logs.previous_hash IS 'SHA-256 content_hash of the preceding audit log for this user';
