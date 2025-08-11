-- Add admin approval columns to partners table
-- This script adds the missing columns needed for partner approval workflow

-- Add approval status column
ALTER TABLE partners 
ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'pending' 
CHECK (approval_status IN ('pending', 'approved', 'rejected', 'suspended'));

-- Add approval tracking columns
ALTER TABLE partners 
ADD COLUMN IF NOT EXISTS approved_by UUID,
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE;

-- Add index on approval status for better performance
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_partners_approval_status') THEN
        CREATE INDEX idx_partners_approval_status ON partners(approval_status);
    END IF;
END $$;

-- Update existing partners to have pending status
UPDATE partners 
SET approval_status = 'pending' 
WHERE approval_status IS NULL;

-- Success message
SELECT 'Admin approval columns added successfully!' as status;