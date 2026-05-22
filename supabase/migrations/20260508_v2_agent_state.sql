-- AGENTSFORTHEWIN Phase 5 — V2 Agent State Protocol migration.
-- Additive only: legacy paths (vault.ts, credits.ts, airlock.ts) are unaffected.
--
-- This migration adds:
--   1. users.credits_milli — sub-cent accumulator column.
--   2. agent_state_snapshots — one row per snapshot.
--   3. atomic_debit_credits_milli_v2  — race-safe debit with rollover.
--   4. atomic_refund_credits_milli_v2 — inverse, used on Irys-failure refund.

------------------------------------------------------------
-- 1. users.credits_milli
------------------------------------------------------------

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS credits_milli BIGINT NOT NULL DEFAULT 0
    CHECK (credits_milli >= 0 AND credits_milli < 1000);

------------------------------------------------------------
-- 2. agent_state_snapshots
------------------------------------------------------------

CREATE TABLE IF NOT EXISTS agent_state_snapshots (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id             TEXT NOT NULL,
  sequence_number      BIGINT NOT NULL CHECK (sequence_number >= 0),
  parent_tx_id         TEXT,
  policy_hash          TEXT NOT NULL CHECK (policy_hash ~ '^[a-fA-F0-9]{64}$'),
  arweave_tx_id        TEXT,
  byte_size            INTEGER NOT NULL CHECK (byte_size > 0 AND byte_size <= 262144),
  cost_milli           INTEGER NOT NULL CHECK (cost_milli >= 0),
  status               TEXT NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending', 'confirmed', 'failed')),
  client_payload_hash  TEXT NOT NULL CHECK (client_payload_hash ~ '^[a-fA-F0-9]{64}$'),
  owner_wallet         TEXT NOT NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at         TIMESTAMPTZ,
  CONSTRAINT agent_state_snapshots_seq_unique UNIQUE (agent_id, sequence_number)
);

CREATE INDEX IF NOT EXISTS idx_agent_state_snapshots_agent_seq_desc
  ON agent_state_snapshots (agent_id, sequence_number DESC);

CREATE INDEX IF NOT EXISTS idx_agent_state_snapshots_owner
  ON agent_state_snapshots (owner_wallet);

------------------------------------------------------------
-- 3. atomic_debit_credits_milli_v2
------------------------------------------------------------
-- Mirrors packages/inheribase-node-sdk/src/pricing.ts applyMilliDebit.
-- Race-safe: SELECT ... FOR UPDATE on the user row, then conditional decrement.
-- Raises 'insufficient_credits' if the projected cents column would go negative.
------------------------------------------------------------

CREATE OR REPLACE FUNCTION atomic_debit_credits_milli_v2(
  p_wallet TEXT,
  p_owed_milli INTEGER
) RETURNS TABLE (new_credits BIGINT, new_credits_milli BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_credits        BIGINT;
  v_milli          BIGINT;
  v_total_milli    BIGINT;
  v_cents_to_burn  BIGINT;
  v_new_milli      BIGINT;
BEGIN
  IF p_owed_milli IS NULL OR p_owed_milli < 0 THEN
    RAISE EXCEPTION 'invalid_owed_milli';
  END IF;

  SELECT credits, credits_milli
    INTO v_credits, v_milli
    FROM users
   WHERE LOWER(wallet_address) = LOWER(p_wallet)
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'user_not_found';
  END IF;

  v_total_milli   := v_milli + p_owed_milli;
  v_cents_to_burn := v_total_milli / 1000;
  v_new_milli     := v_total_milli - (v_cents_to_burn * 1000);

  IF v_credits < v_cents_to_burn THEN
    RAISE EXCEPTION 'insufficient_credits';
  END IF;

  UPDATE users
     SET credits        = v_credits - v_cents_to_burn,
         credits_milli  = v_new_milli
   WHERE LOWER(wallet_address) = LOWER(p_wallet);

  new_credits       := v_credits - v_cents_to_burn;
  new_credits_milli := v_new_milli;
  RETURN NEXT;
END;
$$;

------------------------------------------------------------
-- 4. atomic_refund_credits_milli_v2
------------------------------------------------------------
-- Mirrors applyMilliRefund. Returns whole cents to users.credits when the
-- refund amount exceeds the milli accumulator.
------------------------------------------------------------

CREATE OR REPLACE FUNCTION atomic_refund_credits_milli_v2(
  p_wallet TEXT,
  p_refund_milli INTEGER
) RETURNS TABLE (new_credits BIGINT, new_credits_milli BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_credits          BIGINT;
  v_milli            BIGINT;
  v_deficit          BIGINT;
  v_cents_to_return  BIGINT;
  v_new_milli        BIGINT;
BEGIN
  IF p_refund_milli IS NULL OR p_refund_milli < 0 THEN
    RAISE EXCEPTION 'invalid_refund_milli';
  END IF;

  SELECT credits, credits_milli
    INTO v_credits, v_milli
    FROM users
   WHERE LOWER(wallet_address) = LOWER(p_wallet)
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'user_not_found';
  END IF;

  IF p_refund_milli <= v_milli THEN
    v_new_milli       := v_milli - p_refund_milli;
    v_cents_to_return := 0;
  ELSE
    v_deficit         := p_refund_milli - v_milli;
    v_cents_to_return := CEIL(v_deficit::NUMERIC / 1000)::BIGINT;
    v_new_milli       := (v_cents_to_return * 1000) - v_deficit;
  END IF;

  UPDATE users
     SET credits        = v_credits + v_cents_to_return,
         credits_milli  = v_new_milli
   WHERE LOWER(wallet_address) = LOWER(p_wallet);

  new_credits       := v_credits + v_cents_to_return;
  new_credits_milli := v_new_milli;
  RETURN NEXT;
END;
$$;

------------------------------------------------------------
-- Permissions: edge function uses the service role.
------------------------------------------------------------
GRANT EXECUTE ON FUNCTION atomic_debit_credits_milli_v2(TEXT, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION atomic_refund_credits_milli_v2(TEXT, INTEGER) TO service_role;

COMMENT ON COLUMN users.credits_milli IS
  'V2 sub-cent accumulator. Whole cents spill into users.credits when this crosses 1000. Set by atomic_debit_credits_milli_v2 / atomic_refund_credits_milli_v2.';
COMMENT ON TABLE agent_state_snapshots IS
  'V2 Agent State Protocol — one row per worker state checkpoint persisted to Arweave via Irys. Lineage walks parent_tx_id backwards.';
