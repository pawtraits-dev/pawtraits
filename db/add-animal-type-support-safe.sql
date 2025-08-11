-- =============================================================================
-- ADD ANIMAL TYPE SUPPORT FOR CATS AND DOGS (SAFE VERSION)
-- =============================================================================
-- This migration safely adds animal_type columns only if they don't exist

-- Add animal_type column to breeds table (only if it doesn't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'breeds' AND column_name = 'animal_type') THEN
        ALTER TABLE public.breeds 
        ADD COLUMN animal_type TEXT NOT NULL DEFAULT 'dog' 
        CHECK (animal_type IN ('dog', 'cat'));
        
        -- Update all existing breeds to be dog breeds
        UPDATE public.breeds SET animal_type = 'dog' WHERE animal_type IS NULL;
        
        RAISE NOTICE 'Added animal_type column to breeds table';
    ELSE
        RAISE NOTICE 'animal_type column already exists in breeds table';
    END IF;
END $$;

-- Add animal_type column to coats table (only if it doesn't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'coats' AND column_name = 'animal_type') THEN
        ALTER TABLE public.coats 
        ADD COLUMN animal_type TEXT NOT NULL DEFAULT 'dog' 
        CHECK (animal_type IN ('dog', 'cat'));
        
        -- Update all existing coats to be dog coats
        UPDATE public.coats SET animal_type = 'dog' WHERE animal_type IS NULL;
        
        RAISE NOTICE 'Added animal_type column to coats table';
    ELSE
        RAISE NOTICE 'animal_type column already exists in coats table';
    END IF;
END $$;

-- Add animal_type column to pets table (only if it doesn't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'pets' AND column_name = 'animal_type') THEN
        ALTER TABLE public.pets 
        ADD COLUMN animal_type TEXT NOT NULL DEFAULT 'dog'
        CHECK (animal_type IN ('dog', 'cat'));
        
        -- Update all existing pets to be dog pets
        UPDATE public.pets SET animal_type = 'dog' WHERE animal_type IS NULL;
        
        RAISE NOTICE 'Added animal_type column to pets table';
    ELSE
        RAISE NOTICE 'animal_type column already exists in pets table';
    END IF;
END $$;

-- Add indexes for better query performance (only if they don't exist)
CREATE INDEX IF NOT EXISTS idx_breeds_animal_type ON public.breeds(animal_type);
CREATE INDEX IF NOT EXISTS idx_coats_animal_type ON public.coats(animal_type);
CREATE INDEX IF NOT EXISTS idx_pets_animal_type ON public.pets(animal_type);

-- Add composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_breeds_animal_type_active ON public.breeds(animal_type, is_active);
CREATE INDEX IF NOT EXISTS idx_coats_animal_type_active ON public.coats(animal_type, is_active);
CREATE INDEX IF NOT EXISTS idx_pets_animal_type_active ON public.pets(animal_type, is_active);

-- Verify the changes
SELECT 'breeds' as table_name, animal_type, COUNT(*) as count 
FROM public.breeds 
GROUP BY animal_type
UNION ALL
SELECT 'coats' as table_name, animal_type, COUNT(*) as count 
FROM public.coats 
GROUP BY animal_type
UNION ALL
SELECT 'pets' as table_name, animal_type, COUNT(*) as count 
FROM public.pets 
GROUP BY animal_type;