-- Extended Referral System Database Functions
-- Run this after the main migration script
-- Functions for pre-registration codes, customer referrals, and credit management

-- ===========================================
-- PRE-REGISTRATION CODE FUNCTIONS
-- ===========================================

-- Function to create a pre-registration code
CREATE OR REPLACE FUNCTION create_pre_registration_code(
    p_code VARCHAR(50),
    p_business_category VARCHAR(100) DEFAULT NULL,
    p_expiration_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    p_marketing_campaign VARCHAR(255) DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_print_quantity INTEGER DEFAULT 1,
    p_admin_id UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_code_id UUID;
BEGIN
    -- Insert the pre-registration code
    INSERT INTO pre_registration_codes (
        code,
        business_category,
        expiration_date,
        marketing_campaign,
        notes,
        print_quantity,
        admin_id,
        status
    ) VALUES (
        p_code,
        p_business_category,
        p_expiration_date,
        p_marketing_campaign,
        p_notes,
        p_print_quantity,
        p_admin_id,
        'active'
    ) RETURNING id INTO v_code_id;

    RETURN v_code_id;
END;
$$ LANGUAGE plpgsql;

-- Function to use a pre-registration code when partner signs up
CREATE OR REPLACE FUNCTION use_pre_registration_code(
    p_code VARCHAR(50),
    p_partner_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
    v_code_record pre_registration_codes%ROWTYPE;
BEGIN
    -- Get the pre-registration code
    SELECT * INTO v_code_record
    FROM pre_registration_codes
    WHERE code = p_code AND status = 'active';

    -- Check if code exists and is valid
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- Check if code is expired
    IF v_code_record.expiration_date IS NOT NULL AND v_code_record.expiration_date < NOW() THEN
        -- Mark as expired
        UPDATE pre_registration_codes
        SET status = 'expired', updated_at = NOW()
        WHERE id = v_code_record.id;
        RETURN FALSE;
    END IF;

    -- Mark code as used and link to partner
    UPDATE pre_registration_codes
    SET
        status = 'used',
        partner_id = p_partner_id,
        conversions_count = conversions_count + 1,
        updated_at = NOW()
    WHERE id = v_code_record.id;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to track QR code scan for pre-registration codes
CREATE OR REPLACE FUNCTION track_pre_registration_scan(
    p_code VARCHAR(50)
) RETURNS BOOLEAN AS $$
BEGIN
    UPDATE pre_registration_codes
    SET
        scans_count = scans_count + 1,
        updated_at = NOW()
    WHERE code = p_code AND status IN ('active', 'used');

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- ===========================================
-- CUSTOMER REFERRAL FUNCTIONS
-- ===========================================

-- Function to generate a unique customer referral code
CREATE OR REPLACE FUNCTION generate_customer_referral_code(
    p_customer_id UUID
) RETURNS VARCHAR(50) AS $$
DECLARE
    v_code VARCHAR(50);
    v_customer_name VARCHAR(100);
    v_counter INTEGER := 1;
    v_base_code VARCHAR(40);
BEGIN
    -- Get customer's first name for code generation
    SELECT COALESCE(first_name, 'USER') INTO v_customer_name
    FROM customers
    WHERE id = p_customer_id;

    -- Create base code from name + timestamp
    v_base_code := UPPER(LEFT(v_customer_name, 3)) || TO_CHAR(NOW(), 'MMDD') ||
                   RIGHT(EXTRACT(EPOCH FROM NOW())::TEXT, 4);

    -- Ensure uniqueness
    LOOP
        IF v_counter = 1 THEN
            v_code := v_base_code;
        ELSE
            v_code := v_base_code || v_counter;
        END IF;

        -- Check if code exists
        IF NOT EXISTS (
            SELECT 1 FROM customer_referrals WHERE referral_code = v_code
            UNION
            SELECT 1 FROM customers WHERE personal_referral_code = v_code
        ) THEN
            EXIT;
        END IF;

        v_counter := v_counter + 1;
    END LOOP;

    RETURN v_code;
END;
$$ LANGUAGE plpgsql;

-- Function to create a customer referral
CREATE OR REPLACE FUNCTION create_customer_referral(
    p_referrer_customer_id UUID,
    p_referee_email VARCHAR(255)
) RETURNS TABLE(
    referral_id UUID,
    referral_code VARCHAR(50)
) AS $$
DECLARE
    v_referral_id UUID;
    v_referral_code VARCHAR(50);
BEGIN
    -- Generate unique referral code
    v_referral_code := generate_customer_referral_code(p_referrer_customer_id);

    -- Create the referral record
    INSERT INTO customer_referrals (
        referrer_customer_id,
        referee_email,
        referral_code,
        status
    ) VALUES (
        p_referrer_customer_id,
        p_referee_email,
        v_referral_code,
        'pending'
    ) RETURNING id INTO v_referral_id;

    RETURN QUERY SELECT v_referral_id, v_referral_code;
END;
$$ LANGUAGE plpgsql;

-- Function to track customer referral access
CREATE OR REPLACE FUNCTION track_customer_referral_access(
    p_referral_code VARCHAR(50)
) RETURNS BOOLEAN AS $$
BEGIN
    UPDATE customer_referrals
    SET
        status = CASE
            WHEN status = 'pending' THEN 'accessed'
            ELSE status
        END,
        accessed_at = CASE
            WHEN accessed_at IS NULL THEN NOW()
            ELSE accessed_at
        END,
        updated_at = NOW()
    WHERE referral_code = p_referral_code
      AND status != 'expired'
      AND expires_at > NOW();

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Function to complete customer referral signup
CREATE OR REPLACE FUNCTION complete_customer_referral_signup(
    p_referral_code VARCHAR(50),
    p_referee_customer_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
    v_referral customer_referrals%ROWTYPE;
BEGIN
    -- Get the referral record
    SELECT * INTO v_referral
    FROM customer_referrals
    WHERE referral_code = p_referral_code
      AND status IN ('pending', 'accessed')
      AND expires_at > NOW();

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- Update referral with referee customer ID
    UPDATE customer_referrals
    SET
        referee_customer_id = p_referee_customer_id,
        status = 'signed_up',
        signed_up_at = NOW(),
        updated_at = NOW()
    WHERE id = v_referral.id;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- ===========================================
-- CREDIT MANAGEMENT FUNCTIONS
-- ===========================================

-- Function to initialize customer credits record
CREATE OR REPLACE FUNCTION initialize_customer_credits(
    p_customer_id UUID
) RETURNS UUID AS $$
DECLARE
    v_credits_id UUID;
BEGIN
    INSERT INTO customer_credits (customer_id)
    VALUES (p_customer_id)
    ON CONFLICT (customer_id) DO NOTHING
    RETURNING id INTO v_credits_id;

    -- If no ID returned, get existing record
    IF v_credits_id IS NULL THEN
        SELECT id INTO v_credits_id
        FROM customer_credits
        WHERE customer_id = p_customer_id;
    END IF;

    RETURN v_credits_id;
END;
$$ LANGUAGE plpgsql;

-- Function to award customer referral credits
CREATE OR REPLACE FUNCTION award_referral_credit(
    p_referral_code VARCHAR(50),
    p_order_id UUID,
    p_order_value INTEGER
) RETURNS TABLE(
    credited_amount INTEGER,
    referrer_customer_id UUID
) AS $$
DECLARE
    v_referral customer_referrals%ROWTYPE;
    v_credit_amount INTEGER;
    v_current_balance INTEGER;
BEGIN
    -- Get the referral record
    SELECT * INTO v_referral
    FROM customer_referrals
    WHERE referral_code = p_referral_code
      AND status = 'signed_up';

    IF NOT FOUND THEN
        RETURN;
    END IF;

    -- Calculate 20% credit amount (in cents)
    v_credit_amount := ROUND(p_order_value * 0.20);

    -- Ensure customer has credits record
    PERFORM initialize_customer_credits(v_referral.referrer_customer_id);

    -- Update referral record
    UPDATE customer_referrals
    SET
        status = 'credited',
        order_id = p_order_id,
        order_value = p_order_value,
        credit_amount = v_credit_amount,
        purchased_at = NOW(),
        credited_at = NOW(),
        updated_at = NOW()
    WHERE id = v_referral.id;

    -- Update customer credits
    UPDATE customer_credits
    SET
        total_earned = total_earned + v_credit_amount,
        available_balance = available_balance + v_credit_amount,
        last_credit_earned_at = NOW(),
        updated_at = NOW()
    WHERE customer_id = v_referral.referrer_customer_id
    RETURNING available_balance INTO v_current_balance;

    -- Record transaction
    INSERT INTO customer_credit_transactions (
        customer_id,
        transaction_type,
        amount,
        balance_after,
        reference_type,
        reference_id,
        description
    ) VALUES (
        v_referral.referrer_customer_id,
        'earned',
        v_credit_amount,
        v_current_balance,
        'referral',
        v_referral.id,
        'Credit earned from friend''s first purchase'
    );

    -- Update customer summary fields
    UPDATE customers
    SET
        total_credits_earned = total_credits_earned + v_credit_amount,
        current_credit_balance = current_credit_balance + v_credit_amount
    WHERE id = v_referral.referrer_customer_id;

    RETURN QUERY SELECT v_credit_amount, v_referral.referrer_customer_id;
END;
$$ LANGUAGE plpgsql;

-- Function to apply customer credits to an order
CREATE OR REPLACE FUNCTION apply_customer_credits(
    p_customer_id UUID,
    p_order_value INTEGER,
    p_credits_to_use INTEGER DEFAULT NULL
) RETURNS TABLE(
    credits_applied INTEGER,
    remaining_balance INTEGER,
    final_order_value INTEGER
) AS $$
DECLARE
    v_available_balance INTEGER;
    v_credits_to_apply INTEGER;
    v_new_balance INTEGER;
    v_final_order_value INTEGER;
BEGIN
    -- Get customer's available credit balance
    SELECT available_balance INTO v_available_balance
    FROM customer_credits
    WHERE customer_id = p_customer_id;

    -- If no credits record, return zeros
    IF v_available_balance IS NULL THEN
        v_available_balance := 0;
    END IF;

    -- Determine how many credits to apply
    IF p_credits_to_use IS NULL THEN
        -- Apply all available credits, up to the order value
        v_credits_to_apply := LEAST(v_available_balance, p_order_value);
    ELSE
        -- Apply specified amount, but not more than available or order value
        v_credits_to_apply := LEAST(p_credits_to_use, v_available_balance, p_order_value);
    END IF;

    -- If no credits to apply, return early
    IF v_credits_to_apply <= 0 THEN
        RETURN QUERY SELECT 0, v_available_balance, p_order_value;
        RETURN;
    END IF;

    -- Calculate new balance and final order value
    v_new_balance := v_available_balance - v_credits_to_apply;
    v_final_order_value := p_order_value - v_credits_to_apply;

    -- Update customer credits
    UPDATE customer_credits
    SET
        total_used = total_used + v_credits_to_apply,
        available_balance = v_new_balance,
        last_credit_used_at = NOW(),
        updated_at = NOW()
    WHERE customer_id = p_customer_id;

    -- Record transaction
    INSERT INTO customer_credit_transactions (
        customer_id,
        transaction_type,
        amount,
        balance_after,
        reference_type,
        description
    ) VALUES (
        p_customer_id,
        'used',
        v_credits_to_apply,
        v_new_balance,
        'order',
        'Credits applied to order'
    );

    -- Update customer summary field
    UPDATE customers
    SET current_credit_balance = v_new_balance
    WHERE id = p_customer_id;

    RETURN QUERY SELECT v_credits_to_apply, v_new_balance, v_final_order_value;
END;
$$ LANGUAGE plpgsql;

-- ===========================================
-- UTILITY FUNCTIONS
-- ===========================================

-- Function to get customer referral stats
CREATE OR REPLACE FUNCTION get_customer_referral_stats(
    p_customer_id UUID
) RETURNS TABLE(
    total_referrals INTEGER,
    successful_referrals INTEGER,
    pending_referrals INTEGER,
    total_credits_earned INTEGER,
    available_credits INTEGER,
    personal_referral_code VARCHAR(50)
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        (SELECT COUNT(*)::INTEGER FROM customer_referrals WHERE referrer_customer_id = p_customer_id),
        (SELECT COUNT(*)::INTEGER FROM customer_referrals WHERE referrer_customer_id = p_customer_id AND status IN ('purchased', 'credited')),
        (SELECT COUNT(*)::INTEGER FROM customer_referrals WHERE referrer_customer_id = p_customer_id AND status IN ('pending', 'accessed', 'signed_up')),
        COALESCE(cc.total_earned, 0)::INTEGER,
        COALESCE(cc.available_balance, 0)::INTEGER,
        c.personal_referral_code
    FROM customers c
    LEFT JOIN customer_credits cc ON c.id = cc.customer_id
    WHERE c.id = p_customer_id;
END;
$$ LANGUAGE plpgsql;

-- Function to expire old referrals
CREATE OR REPLACE FUNCTION expire_old_referrals()
RETURNS INTEGER AS $$
DECLARE
    v_expired_count INTEGER;
BEGIN
    -- Expire old customer referrals
    UPDATE customer_referrals
    SET status = 'expired', updated_at = NOW()
    WHERE status IN ('pending', 'accessed', 'signed_up')
      AND expires_at < NOW();

    GET DIAGNOSTICS v_expired_count = ROW_COUNT;

    -- Expire old pre-registration codes
    UPDATE pre_registration_codes
    SET status = 'expired', updated_at = NOW()
    WHERE status = 'active'
      AND expiration_date IS NOT NULL
      AND expiration_date < NOW();

    RETURN v_expired_count;
END;
$$ LANGUAGE plpgsql;

-- ===========================================
-- SUCCESS MESSAGE
-- ===========================================
DO $$
BEGIN
    RAISE NOTICE '✅ Extended Referral System Functions created successfully!';
    RAISE NOTICE '🔧 Pre-registration functions:';
    RAISE NOTICE '   - create_pre_registration_code()';
    RAISE NOTICE '   - use_pre_registration_code()';
    RAISE NOTICE '   - track_pre_registration_scan()';
    RAISE NOTICE '💳 Customer referral functions:';
    RAISE NOTICE '   - create_customer_referral()';
    RAISE NOTICE '   - track_customer_referral_access()';
    RAISE NOTICE '   - complete_customer_referral_signup()';
    RAISE NOTICE '🪙 Credit management functions:';
    RAISE NOTICE '   - award_referral_credit()';
    RAISE NOTICE '   - apply_customer_credits()';
    RAISE NOTICE '📊 Utility functions:';
    RAISE NOTICE '   - get_customer_referral_stats()';
    RAISE NOTICE '   - expire_old_referrals()';
    RAISE NOTICE '';
    RAISE NOTICE '➡️  Next: Run the RLS policies script';
END $$;