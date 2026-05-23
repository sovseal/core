-- Guardian Liveness Protocol Migration
-- Phase: JUMBOONTHEBEAT Phase 3

CREATE TABLE IF NOT EXISTS guardian_liveness (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guardian_id UUID NOT NULL REFERENCES guardians(id) ON DELETE CASCADE,
  vault_id UUID NOT NULL REFERENCES vaults(id) ON DELETE CASCADE,
  last_checkin_at TIMESTAMPTZ,
  next_checkin_due TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'healthy' CHECK (status IN ('healthy', 'stale', 'unresponsive')),
  health_score INTEGER NOT NULL DEFAULT 100 CHECK (health_score >= 0 AND health_score <= 100),
  missed_checkins INTEGER NOT NULL DEFAULT 0,
  email_bounced BOOLEAN DEFAULT FALSE,
  wallet_changed BOOLEAN DEFAULT FALSE,
  declined BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(guardian_id, vault_id)
);

-- Enable RLS
ALTER TABLE guardian_liveness ENABLE ROW LEVEL SECURITY;

-- Service role full access
CREATE POLICY "Service role full access on guardian_liveness" 
ON guardian_liveness 
FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);

-- Index for cron job
CREATE INDEX IF NOT EXISTS idx_guardian_liveness_checkin_due ON guardian_liveness(next_checkin_due) 
WHERE status != 'unresponsive' OR health_score > 0;

-- Index for health score
CREATE INDEX IF NOT EXISTS idx_guardian_liveness_vault_health ON guardian_liveness(vault_id, health_score);

-- Function to handle updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for updated_at
CREATE TRIGGER update_guardian_liveness_updated_at
    BEFORE UPDATE ON guardian_liveness
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
