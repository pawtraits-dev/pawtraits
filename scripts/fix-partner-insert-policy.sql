-- Fix partner INSERT policy
-- This adds the missing INSERT policy for the partners table

-- Drop and recreate INSERT policy for partners
DROP POLICY IF EXISTS "Partners can create their own profile" ON partners;
CREATE POLICY "Partners can create their own profile" ON partners
    FOR INSERT WITH CHECK (auth.uid()::text = id::text);

-- Also ensure authenticated users can insert into referrals
DROP POLICY IF EXISTS "Partners can insert referrals" ON referrals;
CREATE POLICY "Partners can insert referrals" ON referrals
    FOR INSERT WITH CHECK (partner_id IN (SELECT id FROM partners WHERE auth.uid()::text = id::text));

-- Success message
SELECT 'Partner INSERT policies fixed successfully!' as status;