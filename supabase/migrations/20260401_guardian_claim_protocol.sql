-- Guardian Claim Protocol Migration
-- Phase: JUMBOONTHEBEAT Phase 4 (Merge Authority)

-- 1. Create guardian_claims table to track release proposals
CREATE TABLE IF NOT EXISTS public.guardian_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vault_id UUID NOT NULL REFERENCES public.vaults(id) ON DELETE CASCADE,
    initiator_id UUID NOT NULL REFERENCES public.guardians(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'gathering_votes' CHECK (status IN ('gathering_votes', 'approved', 'contested', 'expired')),
    evidence_type TEXT, -- 'death', 'incapacitation', 'incommunicado'
    evidence_details TEXT,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '14 days'),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create guardian_claim_votes table to track consensus
CREATE TABLE IF NOT EXISTS public.guardian_claim_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    claim_id UUID NOT NULL REFERENCES public.guardian_claims(id) ON DELETE CASCADE,
    guardian_id UUID NOT NULL REFERENCES public.guardians(id) ON DELETE CASCADE,
    vote TEXT NOT NULL CHECK (vote IN ('concur', 'reject')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(claim_id, guardian_id)
);

-- 3. Enable RLS
ALTER TABLE public.guardian_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guardian_claim_votes ENABLE ROW LEVEL SECURITY;

-- 4. Service role full access
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service role full access on guardian_claims') THEN
    CREATE POLICY "Service role full access on guardian_claims" ON public.guardian_claims FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service role full access on guardian_claim_votes') THEN
    CREATE POLICY "Service role full access on guardian_claim_votes" ON public.guardian_claim_votes FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 5. Standard audit log for claims
COMMENT ON TABLE public.guardian_claims IS 'Tracks active release proposals initiated by guardians via Merge Authority.';
COMMENT ON TABLE public.guardian_claim_votes IS 'Tracks individual guardian concurrence for active release claims.';

-- 6. Trigger for updated_at on guardian_claims
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_guardian_claims_updated_at ON public.guardian_claims;
CREATE TRIGGER update_guardian_claims_updated_at
    BEFORE UPDATE ON public.guardian_claims
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
