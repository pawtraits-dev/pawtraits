-- =============================================================================
-- ADD ANIMAL TYPE SUPPORT FOR CATS AND DOGS
-- =============================================================================
-- This migration adds animal_type columns to breeds and coats tables
-- to support both cats and dogs in the same system

-- Add animal_type column to breeds table
ALTER TABLE public.breeds 
ADD COLUMN animal_type TEXT NOT NULL DEFAULT 'dog' 
CHECK (animal_type IN ('dog', 'cat'));

-- Add animal_type column to coats table  
ALTER TABLE public.coats 
ADD COLUMN animal_type TEXT NOT NULL DEFAULT 'dog' 
CHECK (animal_type IN ('dog', 'cat'));

-- Add animal_type column to pets table
ALTER TABLE public.pets 
ADD COLUMN animal_type TEXT NOT NULL DEFAULT 'dog'
CHECK (animal_type IN ('dog', 'cat'));

-- Update all existing breeds to be dog breeds (since current data is all dogs)
UPDATE public.breeds SET animal_type = 'dog' WHERE animal_type IS NULL;

-- Update all existing coats to be dog coats (since current data is all dogs)
UPDATE public.coats SET animal_type = 'dog' WHERE animal_type IS NULL;

-- Update all existing pets to be dog pets (since current data is all dogs)
UPDATE public.pets SET animal_type = 'dog' WHERE animal_type IS NULL;

-- Add indexes for better query performance when filtering by animal type
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