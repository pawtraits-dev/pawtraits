-- User Interactions Tracking Schema - Final Conflict-Free Version
-- This schema completely avoids all column naming conflicts

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

-- 4. Create interaction_analytics table for cached aggregated data
DROP TABLE IF EXISTS interaction_analytics CASCADE;
CREATE TABLE interaction_analytics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    image_id UUID NOT NULL REFERENCES image_catalog(id) ON DELETE CASCADE,
    total_likes INTEGER DEFAULT 0,
    total_shares INTEGER DEFAULT 0,
    total_views INTEGER DEFAULT 0,
    unique_users INTEGER DEFAULT 0,
    last_interaction_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Create unique constraint and indexes for interaction_analytics
CREATE UNIQUE INDEX IF NOT EXISTS idx_interaction_analytics_image_id ON interaction_analytics(image_id);
CREATE INDEX IF NOT EXISTS idx_interaction_analytics_likes ON interaction_analytics(total_likes DESC);
CREATE INDEX IF NOT EXISTS idx_interaction_analytics_shares ON interaction_analytics(total_shares DESC);
CREATE INDEX IF NOT EXISTS idx_interaction_analytics_views ON interaction_analytics(total_views DESC);

-- 6. Create function to update interaction analytics
CREATE OR REPLACE FUNCTION update_interaction_analytics(p_image_id UUID)
RETURNS VOID AS $$
BEGIN
    INSERT INTO interaction_analytics (image_id, total_likes, total_shares, total_views, unique_users, last_interaction_at, updated_at)
    SELECT 
        p_image_id,
        COUNT(CASE WHEN interaction_type = 'like' THEN 1 END) - COUNT(CASE WHEN interaction_type = 'unlike' THEN 1 END) as total_likes,
        COUNT(CASE WHEN interaction_type = 'share' THEN 1 END) as total_shares,
        COUNT(CASE WHEN interaction_type = 'view' THEN 1 END) as total_views,
        COUNT(DISTINCT COALESCE(user_id::text, session_id)) as unique_users,
        MAX(created_at) as last_interaction_at,
        NOW() as updated_at
    FROM user_interactions 
    WHERE image_id = p_image_id
    ON CONFLICT (image_id) DO UPDATE SET
        total_likes = EXCLUDED.total_likes,
        total_shares = EXCLUDED.total_shares,
        total_views = EXCLUDED.total_views,
        unique_users = EXCLUDED.unique_users,
        last_interaction_at = EXCLUDED.last_interaction_at,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- 7. Create trigger to auto-update analytics when interactions change
CREATE OR REPLACE FUNCTION trigger_update_interaction_analytics()
RETURNS TRIGGER AS $$
BEGIN
    -- Update analytics for the affected image
    IF TG_OP = 'DELETE' THEN
        PERFORM update_interaction_analytics(OLD.image_id);
        RETURN OLD;
    ELSE
        PERFORM update_interaction_analytics(NEW.image_id);
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 8. Create trigger
DROP TRIGGER IF EXISTS update_analytics_on_interaction ON user_interactions;
CREATE TRIGGER update_analytics_on_interaction
    AFTER INSERT OR UPDATE OR DELETE ON user_interactions
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_interaction_analytics();

-- 9. Create platform_analytics table for detailed sharing analytics
DROP TABLE IF EXISTS platform_analytics CASCADE;
CREATE TABLE platform_analytics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    image_id UUID NOT NULL REFERENCES image_catalog(id) ON DELETE CASCADE,
    platform TEXT NOT NULL,
    total_platform_shares INTEGER DEFAULT 0,
    last_shared_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. Create indexes for platform_analytics
CREATE UNIQUE INDEX IF NOT EXISTS idx_platform_analytics_image_platform ON platform_analytics(image_id, platform);
CREATE INDEX IF NOT EXISTS idx_platform_analytics_platform ON platform_analytics(platform);
CREATE INDEX IF NOT EXISTS idx_platform_analytics_shares ON platform_analytics(total_platform_shares DESC);

-- 11. Create function to update platform analytics
CREATE OR REPLACE FUNCTION update_platform_analytics(p_image_id UUID, p_platform TEXT)
RETURNS VOID AS $$
BEGIN
    INSERT INTO platform_analytics (image_id, platform, total_platform_shares, last_shared_at, updated_at)
    SELECT 
        p_image_id,
        p_platform,
        COUNT(*) as total_platform_shares,
        MAX(created_at) as last_shared_at,
        NOW() as updated_at
    FROM user_interactions 
    WHERE image_id = p_image_id 
      AND interaction_type = 'share' 
      AND platform = p_platform
    ON CONFLICT (image_id, platform) DO UPDATE SET
        total_platform_shares = EXCLUDED.total_platform_shares,
        last_shared_at = EXCLUDED.last_shared_at,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- 12. Enable Row Level Security
ALTER TABLE user_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE interaction_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_analytics ENABLE ROW LEVEL SECURITY;

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

-- 14. Create RLS policies for analytics tables (read-only for users)
DROP POLICY IF EXISTS "Analytics are viewable by everyone" ON interaction_analytics;
CREATE POLICY "Analytics are viewable by everyone" ON interaction_analytics
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Platform analytics are viewable by everyone" ON platform_analytics;
CREATE POLICY "Platform analytics are viewable by everyone" ON platform_analytics
    FOR SELECT USING (true);

-- 15. Grant permissions
GRANT INSERT, SELECT ON user_interactions TO authenticated;
GRANT INSERT, SELECT ON user_interactions TO anon;
GRANT SELECT ON interaction_analytics TO authenticated;
GRANT SELECT ON interaction_analytics TO anon;
GRANT SELECT ON platform_analytics TO authenticated;
GRANT SELECT ON platform_analytics TO anon;

-- 16. Create helpful views for admin analytics with COMPLETELY UNIQUE COLUMN NAMES

-- View: Popular images with interaction analytics (NO COLUMN ALIASES THAT CONFLICT)
DROP VIEW IF EXISTS popular_images_with_analytics;
CREATE VIEW popular_images_with_analytics AS
SELECT 
    ic.id,
    ic.original_filename,
    ic.public_url,
    ic.file_size,
    ic.mime_type,
    ic.description,
    ic.tags,
    ic.prompt_text,
    ic.ai_model,
    ic.breed_id,
    ic.theme_id,
    ic.style_id,
    ic.format_id,
    ic.coat_id,
    ic.rating,
    ic.is_featured,
    ic.is_public,
    ic.upload_session_id,
    ic.created_at,
    ic.updated_at,
    -- Existing share_count from image_catalog (from db/share_tracking.sql)
    ic.share_count as existing_share_count,
    ic.last_shared_at as existing_last_shared_at,
    -- Breed/theme/style names
    b.name as breed_name,
    t.name as theme_name,
    s.name as style_name,
    f.name as format_name,
    cc.name as coat_name,
    -- NEW analytics data with completely unique names
    COALESCE(ia.total_likes, 0) as analytics_like_count,
    COALESCE(ia.total_shares, 0) as analytics_share_count,
    COALESCE(ia.total_views, 0) as analytics_view_count,
    COALESCE(ia.unique_users, 0) as analytics_unique_users,
    ia.last_interaction_at as analytics_last_interaction_at
FROM image_catalog ic
LEFT JOIN interaction_analytics ia ON ic.id = ia.image_id
LEFT JOIN breeds b ON ic.breed_id = b.id
LEFT JOIN themes t ON ic.theme_id = t.id  
LEFT JOIN styles s ON ic.style_id = s.id
LEFT JOIN formats f ON ic.format_id = f.id
LEFT JOIN coats cc ON ic.coat_id = cc.id;

-- View: Platform sharing analytics breakdown
DROP VIEW IF EXISTS platform_sharing_breakdown;
CREATE VIEW platform_sharing_breakdown AS
SELECT 
    pa.platform,
    COUNT(DISTINCT pa.image_id) as images_shared,
    SUM(pa.total_platform_shares) as total_shares,
    AVG(pa.total_platform_shares) as avg_shares_per_image,
    MAX(pa.last_shared_at) as last_activity
FROM platform_analytics pa
GROUP BY pa.platform
ORDER BY total_shares DESC;

-- Grant permissions on views
GRANT SELECT ON popular_images_with_analytics TO authenticated;
GRANT SELECT ON popular_images_with_analytics TO anon;
GRANT SELECT ON platform_sharing_breakdown TO authenticated;
GRANT SELECT ON platform_sharing_breakdown TO anon;

-- Success message
SELECT 'User interactions tracking schema installed successfully! Zero conflicts with existing schema.' as status;