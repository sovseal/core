-- Atomic Credit Operations RPCs
-- Prevents read-then-write TOCTOU race conditions when updating user balances

CREATE OR REPLACE FUNCTION atomic_add_credits(p_wallet text, p_amount integer)
RETURNS boolean AS $$
DECLARE
    v_rows integer;
BEGIN
    UPDATE users
    SET credits = credits + p_amount
    WHERE wallet_address ILIKE p_wallet;
    
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    
    RETURN v_rows > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION atomic_debit_credits(p_wallet text, p_amount integer)
RETURNS boolean AS $$
DECLARE
    v_rows integer;
BEGIN
    UPDATE users
    SET credits = credits - p_amount
    WHERE wallet_address ILIKE p_wallet AND credits >= p_amount;
    
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    
    RETURN v_rows > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
