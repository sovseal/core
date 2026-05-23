-- Migration: JUMBOONTHEBEAT Phase 5 - Agent Audit Log
-- Date: 2026-03-21
-- Persona: SDK Maintainer

BEGIN;

-- Drop existing table if it exists (it was previously incomplete or differently structured)
DROP TABLE IF EXISTS public.agent_audit_log;

CREATE TABLE public.agent_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID NOT NULL REFERENCES public.api_keys(id) ON DELETE CASCADE,
  tool_name TEXT NOT NULL,
  parameters JSONB,
  caller_ip TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  result_status TEXT NOT NULL CHECK (result_status IN ('success', 'error', 'blocked')),
  error_message TEXT,
  execution_time_ms INTEGER,
  sandbox_mode BOOLEAN DEFAULT FALSE,
  vault_id UUID REFERENCES public.vaults(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_agent_audit_log_api_key ON public.agent_audit_log(api_key_id);
CREATE INDEX IF NOT EXISTS idx_agent_audit_log_tool ON public.agent_audit_log(tool_name);
CREATE INDEX IF NOT EXISTS idx_agent_audit_log_timestamp ON public.agent_audit_log(timestamp);

-- Enable RLS
ALTER TABLE public.agent_audit_log ENABLE ROW LEVEL SECURITY;

-- Policy: Vault owners can see audit logs for their vaults or their own API keys
CREATE POLICY "Vault owners can view their agent audit logs"
ON public.agent_audit_log
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.api_keys k
    WHERE k.id = agent_audit_log.api_key_id
    AND k.user_id = auth.uid()::text -- user_id is wallet_address in this project
  )
  OR
  EXISTS (
    SELECT 1 FROM public.vaults v
    WHERE v.id = agent_audit_log.vault_id
    AND v.owner_id = auth.uid()::text
  )
);

COMMIT;
