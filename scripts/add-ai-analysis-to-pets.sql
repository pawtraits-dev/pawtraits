-- Add AI Analysis Column to Pets Table
-- This migration adds support for storing AI-detected pet characteristics from photo analysis

-- Add AI analysis column to pets table
ALTER TABLE pets
ADD COLUMN IF NOT EXISTS ai_analysis_data JSONB;

-- Add comment to explain the column
COMMENT ON COLUMN pets.ai_analysis_data IS 'AI-detected characteristics from photo analysis using Claude vision (breed, coat, personality, physical traits)';

-- Create GIN index for efficient JSONB querying
CREATE INDEX IF NOT EXISTS idx_pets_ai_analysis
ON pets USING GIN (ai_analysis_data);

-- Create specific index for breed detection queries (performance optimization)
CREATE INDEX IF NOT EXISTS idx_pets_ai_breed
ON pets ((ai_analysis_data->>'breed_detected'));

-- Create specific index for coat detection queries
CREATE INDEX IF NOT EXISTS idx_pets_ai_coat
ON pets ((ai_analysis_data->>'coat_detected'));

-- Add AI analysis to pet_photos table (for per-photo analysis)
ALTER TABLE pet_photos
ADD COLUMN IF NOT EXISTS ai_analysis JSONB;

COMMENT ON COLUMN pet_photos.ai_analysis IS 'AI analysis specific to this individual photo';

-- Create GIN index for pet_photos analysis
CREATE INDEX IF NOT EXISTS idx_pet_photos_ai_analysis
ON pet_photos USING GIN (ai_analysis);

-- Example data structure stored in ai_analysis_data:
-- {
--   "breed_detected": "Golden Retriever",
--   "breed_confidence": 9,
--   "coat_detected": "Golden/Light",
--   "coat_confidence": 8,
--   "personality_detected": ["Playful", "Friendly", "Energetic"],
--   "physical_characteristics": {
--     "pose": "sitting",
--     "gaze": "camera",
--     "expression": "happy",
--     "position": "center"
--   },
--   "species": "dog",
--   "analysis_timestamp": "2024-01-15T10:30:00Z",
--   "full_composition_analysis": {
--     "compositionMetadata": { ... },
--     "variationPromptTemplate": "...",
--     "marketingDescription": "..."
--   }
-- }

-- Verification queries
-- Check how many pets have AI analysis:
-- SELECT COUNT(*) as total_pets,
--        COUNT(ai_analysis_data) as analyzed_pets,
--        ROUND(COUNT(ai_analysis_data) * 100.0 / COUNT(*), 2) as percentage_analyzed
-- FROM pets;

-- Find pets with AI-detected breeds:
-- SELECT name,
--        ai_analysis_data->>'breed_detected' as detected_breed,
--        ai_analysis_data->>'breed_confidence' as confidence
-- FROM pets
-- WHERE ai_analysis_data->>'breed_detected' IS NOT NULL
-- ORDER BY (ai_analysis_data->>'breed_confidence')::int DESC
-- LIMIT 10;

-- Find pets with specific personality traits:
-- SELECT name,
--        ai_analysis_data->'personality_detected' as traits
-- FROM pets
-- WHERE ai_analysis_data->'personality_detected' ? 'Playful';
