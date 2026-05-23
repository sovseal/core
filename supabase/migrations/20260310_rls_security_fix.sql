-- Migration: RLS Security Hardening (api_keys & audit_anchors)
-- Date: 2026-03-10
-- Persona: Security Auditor
-- Severity: HIGH (api_keys), MEDIUM (audit_anchors)
-- Findings: Supabase Security Advisor detected RLS disabled in public schema for these tables.

BEGIN;

-- 1. Secure api_keys
-- This table stores hashes of secret keys for Agent/MCP access.
-- Enabling RLS without adding any policies effectively locks it to service_role/admin only.
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- 2. Secure audit_anchors
-- This table stores Merkle roots for on-chain verifiability.
-- Mass scraping of anchors allows mapping of internal institutional state.
ALTER TABLE public.audit_anchors ENABLE ROW LEVEL SECURITY;

-- 3. Verify other security-sensitive tables (Enforce institutional standard)
-- Even if already enabled, we ensure they are active.
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_ledger ENABLE ROW LEVEL SECURITY;

COMMIT;
