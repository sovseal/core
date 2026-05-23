-- Migration: AUTHFORYOU Phase 2 - Identity Chain Re-keying
-- Date: 2026-02-23
-- Persona: DevOps Automator

BEGIN;

--------------------------------------------------------------------------------
-- 1. Data Preservation: Backfill `wallet_address` for legacy users missing it.
--------------------------------------------------------------------------------
-- Make sure wallet_address is populated for everyone. If privy_id is available, 
-- use it as the fallback. Otherwise use the internal ID.
UPDATE public.users 
SET wallet_address = COALESCE(privy_id, id::text) 
WHERE wallet_address IS NULL;

--------------------------------------------------------------------------------
-- 2. Ensure `wallet_address` is Unique and NOT NULL
--------------------------------------------------------------------------------
ALTER TABLE public.users ALTER COLUMN wallet_address SET NOT NULL;
ALTER TABLE public.users ADD CONSTRAINT users_wallet_address_key UNIQUE (wallet_address);

--------------------------------------------------------------------------------
-- 3. Drop Foreign Keys referencing `users(privy_id)` 
--------------------------------------------------------------------------------
-- We drop these explicitly so we can safely change the primary key and user references.
ALTER TABLE public.credit_ledger DROP CONSTRAINT IF EXISTS credit_ledger_user_id_fkey;
ALTER TABLE public.vaults DROP CONSTRAINT IF EXISTS fk_vaults_users;
ALTER TABLE public.vaults DROP CONSTRAINT IF EXISTS vaults_owner_id_fkey;

--------------------------------------------------------------------------------
-- 4. Safely migrate existing records pointing to `privy_id` to `wallet_address`
--------------------------------------------------------------------------------
-- For credit_ledger
UPDATE public.credit_ledger cl
SET user_id = u.wallet_address
FROM public.users u
WHERE cl.user_id = u.privy_id;

-- For vaults
UPDATE public.vaults v
SET owner_id = u.wallet_address
FROM public.users u
WHERE v.owner_id = u.privy_id;

-- For audit_logs (not a strict FK, but data integrity is important)
UPDATE public.audit_logs al
SET user_id = u.wallet_address
FROM public.users u
WHERE al.user_id = u.privy_id;

--------------------------------------------------------------------------------
-- 5. Change properties of `users(privy_id)` to handle new Alchemy users
--------------------------------------------------------------------------------
-- New users won't have a privy_id at all. We must remove the PRIMARY KEY constraint.
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_pkey CASCADE;

-- Relax NOT NULL since new users won't have privy_id
ALTER TABLE public.users ALTER COLUMN privy_id DROP NOT NULL;

-- Make `id` the new PRIMARY KEY
ALTER TABLE public.users ADD PRIMARY KEY (id);

--------------------------------------------------------------------------------
-- 6. Add Foreign Keys referencing the new `wallet_address` constraint
--------------------------------------------------------------------------------
ALTER TABLE public.credit_ledger 
  ADD CONSTRAINT credit_ledger_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES public.users(wallet_address);

ALTER TABLE public.vaults 
  ADD CONSTRAINT vaults_owner_id_fkey 
  FOREIGN KEY (owner_id) REFERENCES public.users(wallet_address);

COMMIT;
