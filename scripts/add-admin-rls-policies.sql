-- Add admin RLS policies to allow admin operations on partners table
-- This script creates policies that allow admin/service role to update partner records

-- For now, we'll create a simple policy that allows service role to update partners
-- In production, this should be more restrictive with proper admin role checking

-- Drop existing restrictive policy and recreate with admin access
DROP POLICY IF EXISTS "Partners can update their own profile" ON partners;

-- Create policy that allows both self-updates and service role updates
CREATE POLICY "Partners and admins can update partner profiles" ON partners
    FOR UPDATE USING (
        auth.uid()::text = id::text OR  -- Partners can update their own profile
        auth.jwt() ->> 'role' = 'service_role' OR  -- Service role can update any
        auth.jwt() ->> 'role' = 'admin'  -- Admin role can update any
    );

-- Alternative approach: Create a separate admin policy
-- CREATE POLICY "Admins can update all partners" ON partners
--     FOR UPDATE USING (auth.jwt() ->> 'role' = 'admin');

-- Grant necessary permissions to service role
GRANT UPDATE ON partners TO service_role;

-- Success message
SELECT 'Admin RLS policies added successfully!' as status;