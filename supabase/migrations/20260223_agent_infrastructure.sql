-- Migration: AUTHFORYOU Phase 3 - Agent Infrastructure
-- Date: 2026-02-23
-- Persona: DevOps Automator

BEGIN;

-- 1. API Keys Table for Agent/MCP Authentication
CREATE TABLE IF NOT EXISTS public.api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES public.users(wallet_address) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT 'Default Agent',
    key_prefix TEXT NOT NULL, -- e.g., 'sov_live_'
    key_hash TEXT NOT NULL UNIQUE, -- SHA-256 of the secret component
    scopes TEXT[] DEFAULT '{read,write}',
    last_used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    revoked_at TIMESTAMPTZ
);

-- Index for fast lookup during MCP authentication
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON public.api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_user ON public.api_keys(user_id);

-- 2. Enhance Audit Logs for Agent tracking
-- We already have user_id, but details should include agent_id
COMMENT ON COLUMN audit_logs.details IS 'JSON payload: { agent_id: UUID, tool: TEXT, params: OBJECT }';

COMMIT;
