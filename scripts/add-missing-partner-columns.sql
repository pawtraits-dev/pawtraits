-- Add missing columns to partners table
-- Run this to add the approval workflow columns

-- Add approval_status column
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='partners' AND column_name='approval_status') THEN
        ALTER TABLE partners ADD COLUMN approval_status TEXT DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected', 'suspended'));
    END IF;
END $$;

-- Add approved_by column  
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='partners' AND column_name='approved_by') THEN
        ALTER TABLE partners ADD COLUMN approved_by UUID;
    END IF;
END $$;

-- Add approved_at column
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='partners' AND column_name='approved_at') THEN
        ALTER TABLE partners ADD COLUMN approved_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- Add rejection_reason column
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='partners' AND column_name='rejection_reason') THEN
        ALTER TABLE partners ADD COLUMN rejection_reason TEXT;
    END IF;
END $$;

-- Add last_login_at column
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='partners' AND column_name='last_login_at') THEN
        ALTER TABLE partners ADD COLUMN last_login_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- Add index for approval_status
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_partners_approval_status') THEN
        CREATE INDEX idx_partners_approval_status ON partners(approval_status);
    END IF;
END $$;

-- Success message
SELECT 'Missing partner columns added successfully!' as status;