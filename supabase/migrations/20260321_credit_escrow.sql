-- JUMBOONTHEBEAT-p2: Credit Escrow and MED-6 Fix
-- Add reserve columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS reserve_cents INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reserve_coverage_years NUMERIC(4,1) DEFAULT 2.0;

-- Update atomic_debit_credits to respect reserve for non-critical operations
CREATE OR REPLACE FUNCTION atomic_debit_credits(
    p_wallet text, 
    p_amount integer, 
    p_is_critical boolean DEFAULT false
)
RETURNS boolean AS $$
DECLARE
    v_rows integer;
    v_reserve integer;
BEGIN
    -- Get current reserve for user
    SELECT COALESCE(reserve_cents, 0) INTO v_reserve 
    FROM users 
    WHERE wallet_address ILIKE p_wallet;
    
    -- If user not found, return false
    IF NOT FOUND THEN
        RETURN false;
    END IF;

    UPDATE users
    SET credits = credits - p_amount
    WHERE wallet_address ILIKE p_wallet 
    AND (
        (p_is_critical AND credits >= p_amount) OR
        (NOT p_is_critical AND (credits - v_reserve) >= p_amount)
    );
    
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    RETURN v_rows > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Atomic reserve synchronization based on current heir count and configuration
CREATE OR REPLACE FUNCTION atomic_sync_reserve(p_wallet text)
RETURNS integer AS $$
DECLARE
    v_heir_count integer;
    v_reserve_cents integer;
    v_coverage_years numeric;
    -- Costs must align with credits.ts constants
    v_check_in_cost integer := 2;
    v_manual_release_cost integer := 100;
    v_download_cost integer := 0;
BEGIN
    -- 1. Get user configuration
    SELECT COALESCE(reserve_coverage_years, 2.0) INTO v_coverage_years
    FROM users 
    WHERE wallet_address ILIKE p_wallet;
    
    IF NOT FOUND THEN
        RETURN 0;
    END IF;

    -- 2. Count active heirs across all vaults owned by this user
    -- We assume owner_id in vaults matches the user's wallet_address
    SELECT count(*) INTO v_heir_count
    FROM heirs
    JOIN vaults ON heirs.vault_id = vaults.id
    WHERE vaults.owner_id ILIKE p_wallet;

    -- 3. Calculate reserve according to formula
    -- (coverage_years * 365 * check_in_cost_cents) + release_cost_cents + (heir_count * download_cost_cents)
    v_reserve_cents := ceil((v_coverage_years * 365 * v_check_in_cost) + v_manual_release_cost + (v_heir_count * v_download_cost));

    -- 4. Update the user's reserve
    UPDATE users 
    SET reserve_cents = v_reserve_cents 
    WHERE wallet_address ILIKE p_wallet;

    RETURN v_reserve_cents;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
