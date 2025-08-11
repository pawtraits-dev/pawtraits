-- User Interactions Tracking Schema
-- This schema adds server-side tracking for user interactions (likes/shares)

-- 1. Create user_interactions table to track all user interactions
CREATE TABLE IF NOT EXISTS user_interactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID, -- Can be null for anonymous users
    session_id TEXT, -- For tracking anonymous users
    image_id UUID NOT NULL REFERENCES image_catalog(id) ON DELETE CASCADE,
    interaction_type TEXT NOT NULL CHECK (interaction_type IN ('like', 'share', 'unlike', 'view')),
    platform TEXT, -- For shares: 'facebook', 'twitter', 'instagram', 'direct_link', etc.
    user_agent TEXT, -- Browser/device info
    ip_address INET, -- User IP for analytics
    referrer TEXT, -- Where the user came from
    metadata JSONB DEFAULT '{}', -- Additional interaction data
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_interactions_image_id ON user_interactions(image_id);
CREATE INDEX IF NOT EXISTS idx_user_interactions_user_id ON user_interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_interactions_session_id ON user_interactions(session_id);
CREATE INDEX IF NOT EXISTS idx_user_interactions_type ON user_interactions(interaction_type);
CREATE INDEX IF NOT EXISTS idx_user_interactions_created_at ON user_interactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_interactions_platform ON user_interactions(platform);

-- 3. Create composite index for common queries
CREATE INDEX IF NOT EXISTS idx_user_interactions_image_type ON user_interactions(image_id, interaction_type);

-- 4. Create interaction_stats table for cached aggregated data
CREATE TABLE IF NOT EXISTS interaction_stats (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    image_id UUID NOT NULL REFERENCES image_catalog(id) ON DELETE CASCADE,
    like_count INTEGER DEFAULT 0,
    share_count INTEGER DEFAULT 0,
    view_count INTEGER DEFAULT 0,
    unique_users INTEGER DEFAULT 0, -- Count of unique users who interacted
    last_interaction_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Create unique constraint and indexes for interaction_stats
CREATE UNIQUE INDEX IF NOT EXISTS idx_interaction_stats_image_id ON interaction_stats(image_id);
CREATE INDEX IF NOT EXISTS idx_interaction_stats_like_count ON interaction_stats(like_count DESC);
CREATE INDEX IF NOT EXISTS idx_interaction_stats_share_count ON interaction_stats(share_count DESC);
CREATE INDEX IF NOT EXISTS idx_interaction_stats_view_count ON interaction_stats(view_count DESC);

-- 6. Create function to update interaction stats
CREATE OR REPLACE FUNCTION update_interaction_stats(p_image_id UUID)
RETURNS VOID AS $$
BEGIN
    INSERT INTO interaction_stats (image_id, like_count, share_count, view_count, unique_users, last_interaction_at, updated_at)
    SELECT 
        p_image_id,
        COUNT(CASE WHEN interaction_type = 'like' THEN 1 END) - COUNT(CASE WHEN interaction_type = 'unlike' THEN 1 END) as like_count,
        COUNT(CASE WHEN interaction_type = 'share' THEN 1 END) as share_count,
        COUNT(CASE WHEN interaction_type = 'view' THEN 1 END) as view_count,
        COUNT(DISTINCT COALESCE(user_id::text, session_id)) as unique_users,
        MAX(created_at) as last_interaction_at,
        NOW() as updated_at
    FROM user_interactions 
    WHERE image_id = p_image_id
    ON CONFLICT (image_id) DO UPDATE SET
        like_count = EXCLUDED.like_count,
        share_count = EXCLUDED.share_count,
        view_count = EXCLUDED.view_count,
        unique_users = EXCLUDED.unique_users,
        last_interaction_at = EXCLUDED.last_interaction_at,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- 7. Create trigger to auto-update stats when interactions change
CREATE OR REPLACE FUNCTION trigger_update_interaction_stats()
RETURNS TRIGGER AS $$
BEGIN
    -- Update stats for the affected image
    IF TG_OP = 'DELETE' THEN
        PERFORM update_interaction_stats(OLD.image_id);
        RETURN OLD;
    ELSE
        PERFORM update_interaction_stats(NEW.image_id);
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 8. Create trigger
DROP TRIGGER IF EXISTS update_stats_on_interaction ON user_interactions;
CREATE TRIGGER update_stats_on_interaction
    AFTER INSERT OR UPDATE OR DELETE ON user_interactions
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_interaction_stats();

-- 9. Create share_platform_stats table for detailed sharing analytics
CREATE TABLE IF NOT EXISTS share_platform_stats (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    image_id UUID NOT NULL REFERENCES image_catalog(id) ON DELETE CASCADE,
    platform TEXT NOT NULL,
    share_count INTEGER DEFAULT 0,
    last_shared_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. Create indexes for share_platform_stats
CREATE UNIQUE INDEX IF NOT EXISTS idx_share_platform_stats_image_platform ON share_platform_stats(image_id, platform);
CREATE INDEX IF NOT EXISTS idx_share_platform_stats_platform ON share_platform_stats(platform);
CREATE INDEX IF NOT EXISTS idx_share_platform_stats_count ON share_platform_stats(share_count DESC);

-- 11. Create function to update platform stats
CREATE OR REPLACE FUNCTION update_platform_stats(p_image_id UUID, p_platform TEXT)
RETURNS VOID AS $$
BEGIN
    INSERT INTO share_platform_stats (image_id, platform, share_count, last_shared_at, updated_at)
    SELECT 
        p_image_id,
        p_platform,
        COUNT(*) as share_count,
        MAX(created_at) as last_shared_at,
        NOW() as updated_at
    FROM user_interactions 
    WHERE image_id = p_image_id 
      AND interaction_type = 'share' 
      AND platform = p_platform
    ON CONFLICT (image_id, platform) DO UPDATE SET
        share_count = EXCLUDED.share_count,
        last_shared_at = EXCLUDED.last_shared_at,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- 12. Enable Row Level Security
ALTER TABLE user_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE interaction_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE share_platform_stats ENABLE ROW LEVEL SECURITY;

-- 13. Create RLS policies for user_interactions
DROP POLICY IF EXISTS "Anyone can insert interactions" ON user_interactions;
CREATE POLICY "Anyone can insert interactions" ON user_interactions
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view their own interactions" ON user_interactions;
CREATE POLICY "Users can view their own interactions" ON user_interactions
    FOR SELECT USING (
        auth.uid() = user_id OR 
        auth.uid() IS NULL OR
        current_setting('role') = 'service_role'
    );

-- 14. Create RLS policies for stats tables (read-only for users)
DROP POLICY IF EXISTS "Stats are viewable by everyone" ON interaction_stats;
CREATE POLICY "Stats are viewable by everyone" ON interaction_stats
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Platform stats are viewable by everyone" ON share_platform_stats;
CREATE POLICY "Platform stats are viewable by everyone" ON share_platform_stats
    FOR SELECT USING (true);

-- 15. Grant permissions
GRANT INSERT, SELECT ON user_interactions TO authenticated;
GRANT INSERT, SELECT ON user_interactions TO anon;
GRANT SELECT ON interaction_stats TO authenticated;
GRANT SELECT ON interaction_stats TO anon;
GRANT SELECT ON share_platform_stats TO authenticated;
GRANT SELECT ON share_platform_stats TO anon;

-- 16. Create helpful views for admin analytics

-- View: Popular images with interaction stats
DROP VIEW IF EXISTS popular_images;
CREATE VIEW popular_images AS
SELECT 
    ic.*,
    b.name as breed_name,
    t.name as theme_name,
    s.name as style_name,
    f.name as format_name,
    cc.name as coat_name,
    COALESCE(ist.like_count, 0) as like_count,
    COALESCE(ist.share_count, 0) as share_count,
    COALESCE(ist.view_count, 0) as view_count,
    COALESCE(ist.unique_users, 0) as unique_users,
    ist.last_interaction_at
FROM image_catalog ic
LEFT JOIN interaction_stats ist ON ic.id = ist.image_id
LEFT JOIN breeds b ON ic.breed_id = b.id
LEFT JOIN themes t ON ic.theme_id = t.id  
LEFT JOIN styles s ON ic.style_id = s.id
LEFT JOIN formats f ON ic.format_id = f.id
LEFT JOIN coats cc ON ic.coat_id = cc.id;

-- View: Sharing platform breakdown
DROP VIEW IF EXISTS platform_sharing_stats;
CREATE VIEW platform_sharing_stats AS
SELECT 
    sps.platform,
    COUNT(DISTINCT sps.image_id) as images_shared,
    SUM(sps.share_count) as total_shares,
    AVG(sps.share_count) as avg_shares_per_image,
    MAX(sps.last_shared_at) as last_activity
FROM share_platform_stats sps
GROUP BY sps.platform
ORDER BY total_shares DESC;

-- Grant permissions on views
GRANT SELECT ON popular_images TO authenticated;
GRANT SELECT ON popular_images TO anon;
GRANT SELECT ON platform_sharing_stats TO authenticated;
GRANT SELECT ON platform_sharing_stats TO anon;

-- Success message
SELECT 'User interactions tracking schema installed successfully!' as status;