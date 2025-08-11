-- User Interactions Tracking Schema - Fixed Version
-- This version properly integrates with the existing share_tracking.sql system
-- and avoids all column naming conflicts

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

-- 4. Add like_count to image_catalog (complementing existing share_count)
ALTER TABLE image_catalog 
ADD COLUMN IF NOT EXISTS like_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_liked_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_viewed_at TIMESTAMP WITH TIME ZONE;

-- 5. Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_image_catalog_like_count ON image_catalog(like_count DESC);
CREATE INDEX IF NOT EXISTS idx_image_catalog_view_count ON image_catalog(view_count DESC);
CREATE INDEX IF NOT EXISTS idx_image_catalog_last_liked ON image_catalog(last_liked_at);
CREATE INDEX IF NOT EXISTS idx_image_catalog_last_viewed ON image_catalog(last_viewed_at);

-- 6. Create interaction_analytics table for detailed analytics (cached aggregated data)
DROP TABLE IF EXISTS interaction_analytics CASCADE;
CREATE TABLE interaction_analytics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    image_id UUID NOT NULL REFERENCES image_catalog(id) ON DELETE CASCADE,
    total_likes INTEGER DEFAULT 0,
    total_unlikes INTEGER DEFAULT 0,
    net_likes INTEGER DEFAULT 0, -- likes minus unlikes
    total_shares INTEGER DEFAULT 0,
    total_views INTEGER DEFAULT 0,
    unique_users INTEGER DEFAULT 0,
    unique_likers INTEGER DEFAULT 0,
    unique_sharers INTEGER DEFAULT 0,
    unique_viewers INTEGER DEFAULT 0,
    first_interaction_at TIMESTAMP WITH TIME ZONE,
    last_interaction_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Create unique constraint and indexes for interaction_analytics
CREATE UNIQUE INDEX IF NOT EXISTS idx_interaction_analytics_image_id ON interaction_analytics(image_id);
CREATE INDEX IF NOT EXISTS idx_interaction_analytics_net_likes ON interaction_analytics(net_likes DESC);
CREATE INDEX IF NOT EXISTS idx_interaction_analytics_total_shares ON interaction_analytics(total_shares DESC);
CREATE INDEX IF NOT EXISTS idx_interaction_analytics_total_views ON interaction_analytics(total_views DESC);
CREATE INDEX IF NOT EXISTS idx_interaction_analytics_unique_users ON interaction_analytics(unique_users DESC);

-- 8. Create function to update image_catalog counters
CREATE OR REPLACE FUNCTION update_image_interaction_counts(p_image_id UUID)
RETURNS VOID AS $$
DECLARE
    like_count_val INTEGER;
    view_count_val INTEGER;
    last_liked_val TIMESTAMP WITH TIME ZONE;
    last_viewed_val TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Calculate like count (likes minus unlikes)
    SELECT 
        COUNT(CASE WHEN interaction_type = 'like' THEN 1 END) - COUNT(CASE WHEN interaction_type = 'unlike' THEN 1 END),
        COUNT(CASE WHEN interaction_type = 'view' THEN 1 END),
        MAX(CASE WHEN interaction_type = 'like' THEN created_at END),
        MAX(CASE WHEN interaction_type = 'view' THEN created_at END)
    INTO like_count_val, view_count_val, last_liked_val, last_viewed_val
    FROM user_interactions 
    WHERE image_id = p_image_id;
    
    -- Update image_catalog with new counts
    UPDATE image_catalog 
    SET 
        like_count = GREATEST(like_count_val, 0), -- Ensure non-negative
        view_count = COALESCE(view_count_val, 0),
        last_liked_at = last_liked_val,
        last_viewed_at = last_viewed_val
    WHERE id = p_image_id;
END;
$$ LANGUAGE plpgsql;

-- 9. Create comprehensive function to update interaction analytics
CREATE OR REPLACE FUNCTION update_interaction_analytics(p_image_id UUID)
RETURNS VOID AS $$
BEGIN
    INSERT INTO interaction_analytics (
        image_id, 
        total_likes, 
        total_unlikes,
        net_likes,
        total_shares, 
        total_views, 
        unique_users,
        unique_likers,
        unique_sharers,
        unique_viewers,
        first_interaction_at,
        last_interaction_at, 
        updated_at
    )
    SELECT 
        p_image_id,
        COUNT(CASE WHEN interaction_type = 'like' THEN 1 END) as total_likes,
        COUNT(CASE WHEN interaction_type = 'unlike' THEN 1 END) as total_unlikes,
        COUNT(CASE WHEN interaction_type = 'like' THEN 1 END) - COUNT(CASE WHEN interaction_type = 'unlike' THEN 1 END) as net_likes,
        COUNT(CASE WHEN interaction_type = 'share' THEN 1 END) as total_shares,
        COUNT(CASE WHEN interaction_type = 'view' THEN 1 END) as total_views,
        COUNT(DISTINCT COALESCE(user_id::text, session_id)) as unique_users,
        COUNT(DISTINCT CASE WHEN interaction_type = 'like' THEN COALESCE(user_id::text, session_id) END) as unique_likers,
        COUNT(DISTINCT CASE WHEN interaction_type = 'share' THEN COALESCE(user_id::text, session_id) END) as unique_sharers,
        COUNT(DISTINCT CASE WHEN interaction_type = 'view' THEN COALESCE(user_id::text, session_id) END) as unique_viewers,
        MIN(created_at) as first_interaction_at,
        MAX(created_at) as last_interaction_at,
        NOW() as updated_at
    FROM user_interactions 
    WHERE image_id = p_image_id
    ON CONFLICT (image_id) DO UPDATE SET
        total_likes = EXCLUDED.total_likes,
        total_unlikes = EXCLUDED.total_unlikes,
        net_likes = EXCLUDED.net_likes,
        total_shares = EXCLUDED.total_shares,
        total_views = EXCLUDED.total_views,
        unique_users = EXCLUDED.unique_users,
        unique_likers = EXCLUDED.unique_likers,
        unique_sharers = EXCLUDED.unique_sharers,
        unique_viewers = EXCLUDED.unique_viewers,
        first_interaction_at = EXCLUDED.first_interaction_at,
        last_interaction_at = EXCLUDED.last_interaction_at,
        updated_at = NOW();
        
    -- Also update the image_catalog counters
    PERFORM update_image_interaction_counts(p_image_id);
END;
$$ LANGUAGE plpgsql;

-- 10. Create trigger function to auto-update analytics when interactions change
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

-- 11. Create trigger
DROP TRIGGER IF EXISTS update_analytics_on_interaction ON user_interactions;
CREATE TRIGGER update_analytics_on_interaction
    AFTER INSERT OR UPDATE OR DELETE ON user_interactions
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_interaction_analytics();

-- 12. Create platform_analytics table for detailed sharing analytics
DROP TABLE IF EXISTS platform_analytics CASCADE;
CREATE TABLE platform_analytics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    image_id UUID NOT NULL REFERENCES image_catalog(id) ON DELETE CASCADE,
    platform TEXT NOT NULL,
    total_platform_shares INTEGER DEFAULT 0,
    unique_platform_sharers INTEGER DEFAULT 0,
    first_shared_at TIMESTAMP WITH TIME ZONE,
    last_shared_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 13. Create indexes for platform_analytics
CREATE UNIQUE INDEX IF NOT EXISTS idx_platform_analytics_image_platform ON platform_analytics(image_id, platform);
CREATE INDEX IF NOT EXISTS idx_platform_analytics_platform ON platform_analytics(platform);
CREATE INDEX IF NOT EXISTS idx_platform_analytics_shares ON platform_analytics(total_platform_shares DESC);

-- 14. Create function to update platform analytics
CREATE OR REPLACE FUNCTION update_platform_analytics(p_image_id UUID, p_platform TEXT)
RETURNS VOID AS $$
BEGIN
    INSERT INTO platform_analytics (
        image_id, 
        platform, 
        total_platform_shares, 
        unique_platform_sharers,
        first_shared_at,
        last_shared_at, 
        updated_at
    )
    SELECT 
        p_image_id,
        p_platform,
        COUNT(*) as total_platform_shares,
        COUNT(DISTINCT COALESCE(user_id::text, session_id)) as unique_platform_sharers,
        MIN(created_at) as first_shared_at,
        MAX(created_at) as last_shared_at,
        NOW() as updated_at
    FROM user_interactions 
    WHERE image_id = p_image_id 
      AND interaction_type = 'share' 
      AND platform = p_platform
    ON CONFLICT (image_id, platform) DO UPDATE SET
        total_platform_shares = EXCLUDED.total_platform_shares,
        unique_platform_sharers = EXCLUDED.unique_platform_sharers,
        first_shared_at = EXCLUDED.first_shared_at,
        last_shared_at = EXCLUDED.last_shared_at,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- 15. Enable Row Level Security
ALTER TABLE user_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE interaction_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_analytics ENABLE ROW LEVEL SECURITY;

-- 16. Create RLS policies for user_interactions
DROP POLICY IF EXISTS "Anyone can insert interactions" ON user_interactions;
CREATE POLICY "Anyone can insert interactions" ON user_interactions
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view their own interactions" ON user_interactions;
CREATE POLICY "Users can view their own interactions" ON user_interactions
    FOR SELECT USING (
        auth.uid() = user_id OR 
        auth.uid() IS NULL OR
        current_setting('role') = 'service_role' OR
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE user_id = auth.uid() 
            AND user_type = 'admin'
        )
    );

-- 17. Create RLS policies for analytics tables (read-only for users)
DROP POLICY IF EXISTS "Analytics are viewable by everyone" ON interaction_analytics;
CREATE POLICY "Analytics are viewable by everyone" ON interaction_analytics
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Platform analytics are viewable by everyone" ON platform_analytics;
CREATE POLICY "Platform analytics are viewable by everyone" ON platform_analytics
    FOR SELECT USING (true);

-- 18. Grant permissions
GRANT INSERT, SELECT ON user_interactions TO authenticated;
GRANT INSERT, SELECT ON user_interactions TO anon;
GRANT SELECT ON interaction_analytics TO authenticated;
GRANT SELECT ON interaction_analytics TO anon;
GRANT SELECT ON platform_analytics TO authenticated;
GRANT SELECT ON platform_analytics TO anon;

-- 19. Create helpful views for admin analytics with COMPLETELY UNIQUE COLUMN NAMES

-- View: Popular images with all interaction data (integrates with existing share_tracking system)
DROP VIEW IF EXISTS popular_images_complete_analytics;
CREATE VIEW popular_images_complete_analytics AS
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
    
    -- EXISTING share tracking data (from share_tracking.sql)
    COALESCE(ic.share_count, 0) as legacy_share_count,
    ic.last_shared_at as legacy_last_shared_at,
    
    -- NEW interaction tracking data (from this system)
    COALESCE(ic.like_count, 0) as current_like_count,
    COALESCE(ic.view_count, 0) as current_view_count,
    ic.last_liked_at as current_last_liked_at,
    ic.last_viewed_at as current_last_viewed_at,
    
    -- Breed/theme/style names
    b.name as breed_name,
    t.name as theme_name,
    s.name as style_name,
    f.name as format_name,
    cc.name as coat_name,
    
    -- DETAILED analytics data with unique prefixes
    COALESCE(ia.total_likes, 0) as detailed_total_likes,
    COALESCE(ia.total_unlikes, 0) as detailed_total_unlikes,
    COALESCE(ia.net_likes, 0) as detailed_net_likes,
    COALESCE(ia.total_shares, 0) as detailed_total_shares,
    COALESCE(ia.total_views, 0) as detailed_total_views,
    COALESCE(ia.unique_users, 0) as detailed_unique_users,
    COALESCE(ia.unique_likers, 0) as detailed_unique_likers,
    COALESCE(ia.unique_sharers, 0) as detailed_unique_sharers,
    COALESCE(ia.unique_viewers, 0) as detailed_unique_viewers,
    ia.first_interaction_at as detailed_first_interaction_at,
    ia.last_interaction_at as detailed_last_interaction_at
    
FROM image_catalog ic
LEFT JOIN interaction_analytics ia ON ic.id = ia.image_id
LEFT JOIN breeds b ON ic.breed_id = b.id
LEFT JOIN themes t ON ic.theme_id = t.id  
LEFT JOIN styles s ON ic.style_id = s.id
LEFT JOIN formats f ON ic.format_id = f.id
LEFT JOIN coats cc ON ic.coat_id = cc.id;

-- View: Platform sharing analytics breakdown
DROP VIEW IF EXISTS platform_sharing_detailed_breakdown;
CREATE VIEW platform_sharing_detailed_breakdown AS
SELECT 
    pa.platform,
    COUNT(DISTINCT pa.image_id) as images_shared_count,
    SUM(pa.total_platform_shares) as platform_total_shares,
    SUM(pa.unique_platform_sharers) as platform_unique_sharers,
    AVG(pa.total_platform_shares) as platform_avg_shares_per_image,
    MIN(pa.first_shared_at) as platform_first_activity,
    MAX(pa.last_shared_at) as platform_last_activity
FROM platform_analytics pa
GROUP BY pa.platform
ORDER BY platform_total_shares DESC;

-- View: Top liked images (simple view for quick queries)
DROP VIEW IF EXISTS top_liked_images;
CREATE VIEW top_liked_images AS
SELECT 
    ic.id,
    ic.original_filename,
    ic.public_url,
    ic.description,
    ic.like_count,
    ic.view_count,
    ic.share_count,
    b.name as breed_name,
    ic.created_at
FROM image_catalog ic
LEFT JOIN breeds b ON ic.breed_id = b.id
WHERE ic.is_public = true
ORDER BY ic.like_count DESC NULLS LAST, ic.view_count DESC NULLS LAST;

-- Grant permissions on views
GRANT SELECT ON popular_images_complete_analytics TO authenticated;
GRANT SELECT ON popular_images_complete_analytics TO anon;
GRANT SELECT ON platform_sharing_detailed_breakdown TO authenticated;
GRANT SELECT ON platform_sharing_detailed_breakdown TO anon;
GRANT SELECT ON top_liked_images TO authenticated;
GRANT SELECT ON top_liked_images TO anon;

-- Helper function to record a user interaction (for use in API routes)
CREATE OR REPLACE FUNCTION record_user_interaction(
    p_user_id UUID,
    p_session_id TEXT,
    p_image_id UUID,
    p_interaction_type TEXT,
    p_platform TEXT DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_ip_address INET DEFAULT NULL,
    p_referrer TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
    interaction_id UUID;
BEGIN
    INSERT INTO user_interactions (
        user_id,
        session_id,
        image_id,
        interaction_type,
        platform,
        user_agent,
        ip_address,
        referrer,
        metadata
    ) VALUES (
        p_user_id,
        p_session_id,
        p_image_id,
        p_interaction_type,
        p_platform,
        p_user_agent,
        p_ip_address,
        p_referrer,
        p_metadata
    ) RETURNING id INTO interaction_id;
    
    -- Update platform analytics if this is a share
    IF p_interaction_type = 'share' AND p_platform IS NOT NULL THEN
        PERFORM update_platform_analytics(p_image_id, p_platform);
    END IF;
    
    RETURN interaction_id;
END;
$$ LANGUAGE plpgsql;

-- Success message
SELECT 'User interactions tracking schema installed successfully! Integrates with existing share_tracking.sql system.' as status;