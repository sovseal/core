-- NOMOREDELAY Phase 3 — Append-only replication log for differential block sync.
-- Additive only: no destructive changes to agent_state_snapshots, users, or credit_ledger.
--
-- This table stores opaque encrypted block diffs indexed by (agent_id, sequence_number).
-- The server never decrypts; it is mathematically blind. It stores ciphertext and metadata.

------------------------------------------------------------
-- 1. agent_replication_log
------------------------------------------------------------

CREATE TABLE agent_replication_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id        uuid NOT NULL,
  sequence_number bigint NOT NULL,
  block_hash      text NOT NULL,
  ciphertext      bytea NOT NULL,
  merkle_root     text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agent_id, sequence_number)
);

CREATE INDEX agent_replication_log_agent_seq_idx
  ON agent_replication_log (agent_id, sequence_number DESC);

------------------------------------------------------------
-- Permissions: edge function uses service_role.
------------------------------------------------------------

COMMENT ON TABLE agent_replication_log IS
  'V2 differential replication log — one row per encrypted block diff. Server stores opaque ciphertext; never decrypts. Indexed by (agent_id, sequence_number) for O(1) append and replay.';
