-- Migration: Add status to heirs and expiry to invitation tables
-- Date: 2026-03-20
-- Persona: Backend Developer (Architecting for Permanence)

BEGIN;

-- 1. Add status to heirs for behavioral parity with guardians
ALTER TABLE public.heirs ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE public.heirs DROP CONSTRAINT IF EXISTS heirs_status_check;
ALTER TABLE public.heirs ADD CONSTRAINT heirs_status_check 
    CHECK (status = ANY (ARRAY['pending'::text, 'active'::text, 'rejected'::text, 'removed'::text, 'expired'::text]));

-- Synchronize legacy 'claimed' boolean with new 'status' column
UPDATE public.heirs SET status = 'active' WHERE claimed = true;
UPDATE public.heirs SET status = 'pending' WHERE (claimed = false OR claimed IS NULL) AND status = 'pending';

-- 2. Add expires_at to enforce 30-day invitation lifecycle (as per INVITATION_FLOW_ARCHITECTURE.md)
ALTER TABLE public.guardians ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT (now() + interval '30 days');
ALTER TABLE public.heirs ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT (now() + interval '30 days');

-- 3. Add rejected to guardians status check if not already present (defensive)
ALTER TABLE public.guardians DROP CONSTRAINT IF EXISTS guardians_status_check;
ALTER TABLE public.guardians ADD CONSTRAINT guardians_status_check 
    CHECK (status = ANY (ARRAY['pending'::text, 'active'::text, 'rejected'::text, 'removed'::text, 'expired'::text]));

COMMIT;
