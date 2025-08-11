-- Create outfits table for pet clothing options in generated images
-- This allows admins to specify what clothes pets are wearing in pictures

-- Create outfits table
CREATE TABLE IF NOT EXISTS outfits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  clothing_description TEXT NOT NULL, -- The actual prompt description for the outfit
  color_scheme TEXT[] DEFAULT '{}', -- Array of colors used in the outfit
  style_keywords TEXT[] DEFAULT '{}', -- Keywords that describe the style
  seasonal_relevance JSONB DEFAULT '{}', -- Which seasons this outfit is appropriate for
  animal_compatibility TEXT[] DEFAULT '{dog,cat}', -- Which animals can wear this outfit
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on slug for fast lookups
CREATE INDEX IF NOT EXISTS idx_outfits_slug ON outfits(slug);

-- Create index on active status
CREATE INDEX IF NOT EXISTS idx_outfits_active ON outfits(is_active);

-- Create index on sort order
CREATE INDEX IF NOT EXISTS idx_outfits_sort_order ON outfits(sort_order);

-- Enable RLS
ALTER TABLE outfits ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Admin users can do everything
CREATE POLICY "Admins can do everything on outfits" ON outfits
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_id = auth.uid() 
      AND user_type = 'admin'
    )
  );

-- Public read access for active outfits (for prompt generation)
CREATE POLICY "Public read access for active outfits" ON outfits
  FOR SELECT USING (is_active = true);

-- Insert some sample outfits
INSERT INTO outfits (name, slug, description, clothing_description, color_scheme, style_keywords, seasonal_relevance, animal_compatibility) VALUES
  (
    'Christmas Sweater', 
    'christmas-sweater', 
    'Festive holiday sweater with Christmas patterns',
    'wearing a cozy red and green Christmas sweater with reindeer patterns',
    ARRAY['red', 'green', 'white'],
    ARRAY['festive', 'cozy', 'holiday', 'warm'],
    '{"winter": true, "christmas": true, "december": true}',
    ARRAY['dog', 'cat']
  ),
  (
    'Superhero Cape', 
    'superhero-cape', 
    'Bold superhero cape for adventurous pets',
    'wearing a flowing red superhero cape',
    ARRAY['red', 'blue', 'gold'],
    ARRAY['heroic', 'bold', 'dramatic', 'flowing'],
    '{}',
    ARRAY['dog', 'cat']
  ),
  (
    'Formal Bow Tie', 
    'formal-bow-tie', 
    'Elegant bow tie for formal occasions',
    'wearing a classic black bow tie',
    ARRAY['black', 'white'],
    ARRAY['formal', 'elegant', 'sophisticated', 'classic'],
    '{}',
    ARRAY['dog', 'cat']
  ),
  (
    'Summer Bandana', 
    'summer-bandana', 
    'Light and breezy bandana for warm weather',
    'wearing a colorful bandana around the neck',
    ARRAY['blue', 'yellow', 'red'],
    ARRAY['casual', 'summer', 'breezy', 'colorful'],
    '{"summer": true, "spring": true}',
    ARRAY['dog', 'cat']
  ),
  (
    'Rain Coat', 
    'rain-coat', 
    'Waterproof coat for rainy days',
    'wearing a bright yellow raincoat',
    ARRAY['yellow', 'blue'],
    ARRAY['practical', 'waterproof', 'bright', 'protective'],
    '{"spring": true, "autumn": true, "rainy": true}',
    ARRAY['dog', 'cat']
  ),
  (
    'Birthday Hat', 
    'birthday-hat', 
    'Festive party hat for celebrations',
    'wearing a colorful party hat with streamers',
    ARRAY['pink', 'blue', 'yellow', 'purple'],
    ARRAY['festive', 'party', 'celebration', 'colorful'],
    '{}',
    ARRAY['dog', 'cat']
  ),
  (
    'No Outfit', 
    'no-outfit', 
    'Natural look without any clothing',
    '',
    ARRAY[]::TEXT[],
    ARRAY['natural', 'authentic'],
    '{}',
    ARRAY['dog', 'cat']
  );

-- Create update trigger to automatically update updated_at
CREATE OR REPLACE FUNCTION update_outfits_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_outfits_updated_at
  BEFORE UPDATE ON outfits
  FOR EACH ROW
  EXECUTE FUNCTION update_outfits_updated_at();

-- Grant permissions
GRANT ALL ON outfits TO authenticated;
GRANT ALL ON outfits TO service_role;