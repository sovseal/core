-- sovseal: Real-metal persistence for the v2 agent state protocol.
-- Mission sovseal-mcp-real — backs save_context / load_context MCP tools.

CREATE TABLE IF NOT EXISTS public.agent_state_snapshots (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id            TEXT        NOT NULL,
    owner_wallet        TEXT        NOT NULL,   -- sov_proj_<uuid v4> (self-asserting) or wallet hex
    status              TEXT        NOT NULL DEFAULT 'confirmed',
    arweave_tx_id       TEXT        NOT NULL UNIQUE,  -- Storage object path while Irys is offline
    sequence_number     INTEGER     NOT NULL,
    parent_tx_id        TEXT,
    policy_hash         TEXT        NOT NULL,
    client_payload_hash TEXT        NOT NULL,
    byte_size           INTEGER     NOT NULL,
    cost_milli          INTEGER     NOT NULL DEFAULT 0,
    confirmed_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Composite lookup index for restore.ts's .eq().eq().eq().order() pattern.
CREATE INDEX IF NOT EXISTS idx_snapshots_lookup
    ON public.agent_state_snapshots (agent_id, owner_wallet, status, sequence_number DESC);

-- Genesis + chain rules at the DB layer.
ALTER TABLE public.agent_state_snapshots
    ADD CONSTRAINT chk_genesis_no_parent
    CHECK ((sequence_number = 0 AND parent_tx_id IS NULL)
        OR (sequence_number > 0 AND parent_tx_id IS NOT NULL));

ALTER TABLE public.agent_state_snapshots
    ADD CONSTRAINT chk_unique_agent_sequence
    UNIQUE (agent_id, owner_wallet, sequence_number);
