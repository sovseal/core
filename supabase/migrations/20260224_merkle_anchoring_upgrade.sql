
-- ==========================================================================
-- VERIFIABILITY UPGRADE: Merkle Anchoring (Phase 3)
-- Applied: 2026-02-24
-- Purpose: Batch audit logs and anchor them to Base Sepolia.
-- ==========================================================================

-- 1. Create audit_anchors table
-- Stores the Merkle roots published on-chain.
CREATE TABLE IF NOT EXISTS public.audit_anchors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merkle_root TEXT NOT NULL,
  tx_hash TEXT NOT NULL,
  chain_id INTEGER NOT NULL DEFAULT 84532, -- Default to Base Sepolia
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Add anchor_id to audit_logs
-- Links individual logs to a batch anchor.
ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS anchor_id UUID REFERENCES public.audit_anchors(id);

-- 3. Add attestation_uid for EAS
-- Stores the Ethereum Attestation Service UID if applicable.
ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS attestation_uid TEXT;

-- 4. Index for performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_anchor_id ON public.audit_logs(anchor_id);

COMMENT ON TABLE public.audit_anchors IS 'On-chain Merkle root anchors for audit log verifiability';
COMMENT ON COLUMN public.audit_logs.anchor_id IS 'Reference to the on-chain Merkle anchor';
COMMENT ON COLUMN public.audit_logs.attestation_uid IS 'Ethereum Attestation Service (EAS) UID for verified events';
