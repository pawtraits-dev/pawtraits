    -- Share tracking tables for analytics
    -- Run this after the main database setup

    -- Table to track all share events
    CREATE TABLE IF NOT EXISTS share_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        image_id UUID NOT NULL REFERENCES image_catalog(id) ON DELETE CASCADE,
        user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
        user_email TEXT,
        platform TEXT NOT NULL, -- 'facebook', 'instagram', 'twitter', 'whatsapp', 'messenger', 'copy', 'native'
        share_url TEXT NOT NULL,
        user_agent TEXT,
        ip_address INET,
        referrer TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- Table to track social media accounts that content was shared to
    CREATE TABLE IF NOT EXISTS social_accounts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        platform TEXT NOT NULL, -- 'facebook', 'instagram', 'twitter'
        platform_user_id TEXT, -- The user's ID on that platform
        username TEXT, -- The username/handle on that platform
        display_name TEXT, -- The display name on that platform
        profile_url TEXT, -- Link to their profile
        follower_count INTEGER, -- Number of followers (if available)
        verified BOOLEAN DEFAULT FALSE, -- Whether the account is verified
        last_shared_at TIMESTAMP WITH TIME ZONE,
        first_shared_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        total_shares INTEGER DEFAULT 1,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(platform, platform_user_id)
    );

    -- Junction table linking share events to social accounts
    CREATE TABLE IF NOT EXISTS share_social_accounts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        share_event_id UUID NOT NULL REFERENCES share_events(id) ON DELETE CASCADE,
        social_account_id UUID NOT NULL REFERENCES social_accounts(id) ON DELETE CASCADE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(share_event_id, social_account_id)
    );

    -- Add share count to image catalog for quick access
    ALTER TABLE image_catalog 
    ADD COLUMN IF NOT EXISTS share_count INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_shared_at TIMESTAMP WITH TIME ZONE;

    -- Indexes for performance
    CREATE INDEX IF NOT EXISTS idx_share_events_image_id ON share_events(image_id);
    CREATE INDEX IF NOT EXISTS idx_share_events_platform ON share_events(platform);
    CREATE INDEX IF NOT EXISTS idx_share_events_created_at ON share_events(created_at);
    CREATE INDEX IF NOT EXISTS idx_share_events_user_id ON share_events(user_id);

    CREATE INDEX IF NOT EXISTS idx_social_accounts_platform ON social_accounts(platform);
    CREATE INDEX IF NOT EXISTS idx_social_accounts_username ON social_accounts(username);
    CREATE INDEX IF NOT EXISTS idx_social_accounts_last_shared ON social_accounts(last_shared_at);

    CREATE INDEX IF NOT EXISTS idx_image_catalog_share_count ON image_catalog(share_count);
    CREATE INDEX IF NOT EXISTS idx_image_catalog_last_shared ON image_catalog(last_shared_at);

    -- Function to update image catalog share counts
    CREATE OR REPLACE FUNCTION update_image_share_count()
    RETURNS TRIGGER AS $$
    BEGIN
        -- Update the image catalog with new share count and timestamp
        UPDATE image_catalog 
        SET 
            share_count = (
                SELECT COUNT(*) 
                FROM share_events 
                WHERE image_id = NEW.image_id
            ),
            last_shared_at = NEW.created_at
        WHERE id = NEW.image_id;
        
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    -- Trigger to automatically update share counts
    DROP TRIGGER IF EXISTS trigger_update_image_share_count ON share_events;
    CREATE TRIGGER trigger_update_image_share_count
        AFTER INSERT ON share_events
        FOR EACH ROW EXECUTE FUNCTION update_image_share_count();

    -- Function to update social account stats
    CREATE OR REPLACE FUNCTION update_social_account_stats()
    RETURNS TRIGGER AS $$
    BEGIN
        -- Update the social account with new share count and timestamp
        UPDATE social_accounts 
        SET 
            total_shares = (
                SELECT COUNT(*) 
                FROM share_social_accounts 
                WHERE social_account_id = NEW.social_account_id
            ),
            last_shared_at = NOW()
        WHERE id = NEW.social_account_id;
        
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    -- Trigger to automatically update social account stats
    DROP TRIGGER IF EXISTS trigger_update_social_account_stats ON share_social_accounts;
    CREATE TRIGGER trigger_update_social_account_stats
        AFTER INSERT ON share_social_accounts
        FOR EACH ROW EXECUTE FUNCTION update_social_account_stats();

    -- RLS Policies

    -- Share events: Allow authenticated users to insert their own, admins to read all
    ALTER TABLE share_events ENABLE ROW LEVEL SECURITY;

    CREATE POLICY "Users can insert own share events" ON share_events
        FOR INSERT WITH CHECK (
            auth.uid() = user_id OR 
            user_id IS NULL -- Allow anonymous shares
        );

    CREATE POLICY "Admins can read all share events" ON share_events
        FOR SELECT USING (
            EXISTS (
                SELECT 1 FROM user_profiles 
                WHERE user_id = auth.uid() 
                AND user_type = 'admin'
            )
        );

    -- Social accounts: Only admins can read/write
    ALTER TABLE social_accounts ENABLE ROW LEVEL SECURITY;

    CREATE POLICY "Admins can manage social accounts" ON social_accounts
        FOR ALL USING (
            EXISTS (
                SELECT 1 FROM user_profiles 
                WHERE user_id = auth.uid() 
                AND user_type = 'admin'
            )
        );

    -- Share social accounts: Only admins can read/write
    ALTER TABLE share_social_accounts ENABLE ROW LEVEL SECURITY;

    CREATE POLICY "Admins can manage share social accounts" ON share_social_accounts
        FOR ALL USING (
            EXISTS (
                SELECT 1 FROM user_profiles 
                WHERE user_id = auth.uid() 
                AND user_type = 'admin'
            )
        );

    -- Grant permissions
    GRANT SELECT, INSERT ON share_events TO authenticated;
    GRANT SELECT, INSERT, UPDATE ON social_accounts TO authenticated;
    GRANT SELECT, INSERT ON share_social_accounts TO authenticated;