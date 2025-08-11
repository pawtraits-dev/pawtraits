-- Migration to split client_name into client_first_name and client_last_name
-- This updates the referrals table to have separate name fields

BEGIN;

-- Add new columns for first and last names
ALTER TABLE referrals 
ADD COLUMN client_first_name TEXT,
ADD COLUMN client_last_name TEXT;

-- Split existing client_name data into first and last names
UPDATE referrals 
SET 
    client_first_name = TRIM(SPLIT_PART(client_name, ' ', 1)),
    client_last_name = CASE 
        WHEN ARRAY_LENGTH(STRING_TO_ARRAY(client_name, ' '), 1) > 1 
        THEN TRIM(SUBSTRING(client_name FROM POSITION(' ' IN client_name) + 1))
        ELSE ''
    END
WHERE client_name IS NOT NULL AND client_name != '';

-- For Method 2 referrals with placeholder names, set appropriate defaults
UPDATE referrals 
SET 
    client_first_name = COALESCE(client_first_name, ''),
    client_last_name = COALESCE(client_last_name, '')
WHERE client_first_name IS NULL OR client_last_name IS NULL;

-- Show what we're about to change
SELECT 'BEFORE DROPPING client_name - Sample of updated data:' as info;
SELECT 
    id,
    client_name as original_name,
    client_first_name,
    client_last_name,
    referral_type
FROM referrals 
WHERE client_name IS NOT NULL 
ORDER BY created_at DESC 
LIMIT 10;

-- Drop the old client_name column
ALTER TABLE referrals DROP COLUMN client_name;

-- Add NOT NULL constraints for traditional referrals
-- Note: We'll keep these nullable for Method 2 referrals initially
-- ALTER TABLE referrals ALTER COLUMN client_first_name SET NOT NULL;
-- ALTER TABLE referrals ALTER COLUMN client_last_name SET NOT NULL;

SELECT 'SUCCESS: client_name split into client_first_name and client_last_name' as result;

-- Show final structure
SELECT 'AFTER MIGRATION - Column structure:' as info;
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'referrals' 
AND column_name LIKE 'client_%'
ORDER BY column_name;

COMMIT;