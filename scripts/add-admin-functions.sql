-- Create admin functions with SECURITY DEFINER to bypass RLS
-- This allows admin operations while maintaining security

-- Function to update partner approval status (bypasses RLS)
CREATE OR REPLACE FUNCTION admin_update_partner_status(
    partner_uuid UUID,
    new_approval_status TEXT,
    admin_id UUID DEFAULT NULL,
    rejection_reason_text TEXT DEFAULT NULL
) RETURNS partners AS $$
DECLARE
    updated_partner partners;
    current_time TIMESTAMP WITH TIME ZONE := NOW();
BEGIN
    -- Validate approval status
    IF new_approval_status NOT IN ('pending', 'approved', 'rejected', 'suspended') THEN
        RAISE EXCEPTION 'Invalid approval status: %', new_approval_status;
    END IF;
    
    -- Update the partner record
    UPDATE partners
    SET 
        approval_status = new_approval_status,
        approved_by = CASE WHEN new_approval_status = 'approved' THEN admin_id ELSE approved_by END,
        approved_at = CASE WHEN new_approval_status = 'approved' THEN current_time ELSE COALESCE(approved_at, NULL) END,
        rejection_reason = CASE WHEN new_approval_status = 'rejected' THEN rejection_reason_text ELSE rejection_reason END,
        updated_at = current_time
    WHERE id = partner_uuid
    RETURNING * INTO updated_partner;
    
    -- Check if partner was found and updated
    IF updated_partner IS NULL THEN
        RAISE EXCEPTION 'Partner not found with ID: %', partner_uuid;
    END IF;
    
    RETURN updated_partner;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users (for admin API)
GRANT EXECUTE ON FUNCTION admin_update_partner_status(UUID, TEXT, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_update_partner_status(UUID, TEXT, UUID, TEXT) TO anon;

-- Success message
SELECT 'Admin functions created successfully!' as status;