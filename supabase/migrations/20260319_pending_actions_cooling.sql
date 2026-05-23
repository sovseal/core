-- Migration: SCORPIONSCICCOR Phase 6 - Cooling Periods for Destructive Actions
-- Date: 2026-03-19
-- Persona: Backend Developer

BEGIN;

-- 1. Create Enum for destructive action types
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pending_action_type') THEN
        CREATE TYPE public.pending_action_type AS ENUM ('REMOVE_GUARDIAN', 'REMOVE_HEIR', 'DISABLE_DMS');
    END IF;
END $$;

-- 2. Create pending_actions table
CREATE TABLE IF NOT EXISTS public.pending_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_address TEXT NOT NULL REFERENCES public.users(wallet_address) ON DELETE CASCADE,
    vault_id UUID NOT NULL REFERENCES public.vaults(id) ON DELETE CASCADE,
    action_type public.pending_action_type NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    initiated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    executes_at TIMESTAMPTZ NOT NULL,
    cancelled BOOLEAN NOT NULL DEFAULT false,
    notification_sent BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Enable RLS and add policies
ALTER TABLE public.pending_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can query their own pending actions" ON public.pending_actions;
CREATE POLICY "Users can query their own pending actions"
    ON public.pending_actions
    FOR SELECT
    USING (user_address = auth.jwt() ->> 'wallet_address' OR user_address = (SELECT wallet_address FROM public.users WHERE auth.uid() = id));

-- Note: The auth helper 'authenticate' uses the 'Signature' header, but Supabase RLS uses 'auth.uid()'.
-- In this project, 'auth.uid()' refers to the UUID from 'auth.users'.
-- And 'public.users.id' matches 'auth.users.id'.

DROP POLICY IF EXISTS "Users can update their own pending actions" ON public.pending_actions;
CREATE POLICY "Users can update their own pending actions"
    ON public.pending_actions
    FOR UPDATE
    USING (user_address = (SELECT wallet_address FROM public.users WHERE auth.uid() = id));

-- 4. Create index for the execution cron job
CREATE INDEX IF NOT EXISTS idx_pending_actions_executes_at 
ON public.pending_actions(executes_at) 
WHERE (NOT cancelled);

COMMIT;
