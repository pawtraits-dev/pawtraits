-- SECURITY CRITICAL: Replace dangerous temporary RLS policies with secure ones
-- This script removes all overly permissive policies and implements proper security

-- =================================================================
-- REMOVE ALL DANGEROUS TEMPORARY POLICIES
-- =================================================================

-- Remove the most dangerous temporary policy that allows all access
DROP POLICY IF EXISTS "Temporary test access" ON user_interactions;

-- Remove other overly permissive policies
DROP POLICY IF EXISTS "Allow interaction inserts" ON user_interactions;
DROP POLICY IF EXISTS "Public analytics access" ON interaction_analytics;
DROP POLICY IF EXISTS "Public platform analytics access" ON platform_analytics;

-- =================================================================
-- IMPLEMENT SECURE RLS POLICIES
-- =================================================================

-- User Interactions Table - Proper Security
CREATE POLICY "user_interactions_select_policy" ON user_interactions
    FOR SELECT USING (
        -- Users can only see their own interactions
        auth.uid() = user_id
        -- OR Admin users can see all (check user_type in auth metadata)
        OR EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid() 
            AND user_type = 'admin'
        )
    );

CREATE POLICY "user_interactions_insert_policy" ON user_interactions
    FOR INSERT WITH CHECK (
        -- Must be authenticated OR anonymous users for public interactions
        (auth.uid() IS NOT NULL AND auth.uid() = user_id)
        OR 
        -- Allow anonymous interactions for public features
        (auth.uid() IS NULL AND user_id IS NULL)
    );

CREATE POLICY "user_interactions_update_policy" ON user_interactions
    FOR UPDATE USING (
        -- Users can only update their own interactions
        auth.uid() = user_id
        -- OR Admin users can update all
        OR EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid() 
            AND user_type = 'admin'
        )
    );

CREATE POLICY "user_interactions_delete_policy" ON user_interactions
    FOR DELETE USING (
        -- Only admins can delete interactions
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid() 
            AND user_type = 'admin'
        )
    );

-- Analytics Tables - Restricted Access
CREATE POLICY "interaction_analytics_select_policy" ON interaction_analytics
    FOR SELECT USING (
        -- Only admin users can view analytics
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid() 
            AND user_type = 'admin'
        )
    );

CREATE POLICY "platform_analytics_select_policy" ON platform_analytics
    FOR SELECT USING (
        -- Only admin users can view platform analytics
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid() 
            AND user_type = 'admin'
        )
    );

-- =================================================================
-- AUDIT TRAIL AND MONITORING
-- =================================================================

-- Log this security update
INSERT INTO audit_logs (
    action,
    actor_id, 
    actor_type,
    resource_type,
    metadata,
    timestamp
) VALUES (
    'SECURITY_POLICY_UPDATE',
    auth.uid(),
    'system',
    'rls_policies',
    jsonb_build_object(
        'action', 'removed_temporary_policies',
        'tables', array['user_interactions', 'interaction_analytics', 'platform_analytics'],
        'security_level', 'critical'
    ),
    NOW()
);

-- Verify policies were created successfully
DO $$
DECLARE
    policy_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename IN ('user_interactions', 'interaction_analytics', 'platform_analytics')
    AND policyname NOT LIKE '%temp%';
    
    IF policy_count < 6 THEN
        RAISE EXCEPTION 'Security Error: Not all secure policies were created. Count: %', policy_count;
    END IF;
    
    RAISE NOTICE 'Security Success: % secure RLS policies implemented', policy_count;
END $$;

-- Success confirmation
SELECT 
    'SECURITY CRITICAL FIXES APPLIED' as status,
    'Temporary RLS policies removed and replaced with secure policies' as message,
    NOW() as applied_at;