-- Safe migration for referrals table - handles existing policies and columns
BEGIN;

-- Check current table structure
SELECT 'Current referrals table columns:' as info;
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'referrals' 
ORDER BY column_name;

-- Add client_first_name column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'referrals' AND column_name = 'client_first_name'
    ) THEN
        ALTER TABLE referrals ADD COLUMN client_first_name TEXT;
        RAISE NOTICE 'Added client_first_name column';
    ELSE
        RAISE NOTICE 'client_first_name column already exists';
    END IF;
END $$;

-- Add client_last_name column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'referrals' AND column_name = 'client_last_name'
    ) THEN
        ALTER TABLE referrals ADD COLUMN client_last_name TEXT;
        RAISE NOTICE 'Added client_last_name column';
    ELSE
        RAISE NOTICE 'client_last_name column already exists';
    END IF;
END $$;

-- Add referral_type column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'referrals' AND column_name = 'referral_type'
    ) THEN
        ALTER TABLE referrals ADD COLUMN referral_type TEXT DEFAULT 'traditional';
        RAISE NOTICE 'Added referral_type column';
    ELSE
        RAISE NOTICE 'referral_type column already exists';
    END IF;
END $$;

-- Add image_id column if it doesn't exist  
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'referrals' AND column_name = 'image_id'
    ) THEN
        ALTER TABLE referrals ADD COLUMN image_id UUID REFERENCES image_catalog(id);
        RAISE NOTICE 'Added image_id column';
    ELSE
        RAISE NOTICE 'image_id column already exists';
    END IF;
END $$;

-- Make client_name nullable if it exists (for backwards compatibility)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'referrals' AND column_name = 'client_name'
    ) THEN
        ALTER TABLE referrals ALTER COLUMN client_name DROP NOT NULL;
        RAISE NOTICE 'Made client_name column nullable';
    ELSE
        RAISE NOTICE 'client_name column does not exist';
    END IF;
END $$;

-- Add CHECK constraints if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'referrals_type_check' AND table_name = 'referrals'
    ) THEN
        ALTER TABLE referrals ADD CONSTRAINT referrals_type_check 
            CHECK (referral_type IN ('traditional', 'image_share'));
        RAISE NOTICE 'Added referral_type check constraint';
    ELSE
        RAISE NOTICE 'referral_type check constraint already exists';
    END IF;
END $$;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_referrals_type ON referrals(referral_type);
CREATE INDEX IF NOT EXISTS idx_referrals_image_id ON referrals(image_id);
CREATE INDEX IF NOT EXISTS idx_referrals_first_name ON referrals(client_first_name);
CREATE INDEX IF NOT EXISTS idx_referrals_last_name ON referrals(client_last_name);

-- Check final table structure
SELECT 'Final referrals table columns:' as info;
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'referrals' 
ORDER BY column_name;

SELECT 'Migration completed successfully!' as result;

COMMIT;