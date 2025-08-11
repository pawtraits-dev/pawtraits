-- =============================================================================
-- PAWTRAITS COMPLETE DATABASE REBUILD SCRIPT
-- =============================================================================
-- Run this entire script in Supabase SQL Editor to rebuild from scratch
-- This will drop existing tables and recreate everything with enhanced features

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing tables if they exist (in correct order due to foreign keys)
DROP TABLE IF EXISTS generated_prompts CASCADE;
DROP TABLE IF EXISTS theme_style_combinations CASCADE;
DROP TABLE IF EXISTS prompt_templates CASCADE;
DROP TABLE IF EXISTS formats CASCADE;
DROP TABLE IF EXISTS styles CASCADE;
DROP TABLE IF EXISTS themes CASCADE;
DROP TABLE IF EXISTS breeds CASCADE;

-- Drop existing functions if they exist
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- =============================================================================
-- CORE TABLES
-- =============================================================================

-- Breeds table with rich descriptions
CREATE TABLE breeds (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE, -- for URLs and tagging
  description TEXT NOT NULL, -- The hilarious breed descriptions
  physical_traits JSONB DEFAULT '{}', -- {"size": "medium", "coat": "long", "colors": ["golden", "cream"]}
  personality_traits TEXT[], -- ["friendly", "energetic", "loyal"]
  alternative_names TEXT[], -- ["Golden", "Goldie", "Retriever"]
  popularity_rank INTEGER, -- 1 = most popular
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}', -- Any additional data
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Themes table (Christmas, Sports, etc.)
CREATE TABLE themes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  base_prompt_template TEXT NOT NULL, -- The core prompt structure
  style_keywords TEXT[], -- ["festive", "holiday", "seasonal"]
  seasonal_relevance JSONB DEFAULT '{}', -- {"peak_months": [11, 12], "off_season": [6, 7, 8]}
  difficulty_level INTEGER DEFAULT 1, -- 1-5, how hard to generate good results
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Styles table (realistic, artistic, vintage, etc.)
CREATE TABLE styles (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  prompt_suffix TEXT NOT NULL, -- What gets added to prompts for this style
  technical_parameters JSONB DEFAULT '{}', -- {"aspect_ratio": "4:5", "style_weight": 0.8}
  compatible_themes TEXT[], -- Which themes work well with this style
  difficulty_level INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Formats table (NEW - for multi-platform support)
CREATE TABLE formats (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  aspect_ratio TEXT NOT NULL, -- "4:5", "1:1", "9:16", "16:9"
  use_case TEXT NOT NULL, -- "product", "social", "story", "banner"
  prompt_adjustments TEXT, -- Additional prompt modifications for this format
  midjourney_parameters TEXT DEFAULT '--style raw --v 6', -- MJ specific params
  technical_specs JSONB DEFAULT '{}', -- {"dpi": 300, "max_size": "2048x2560"}
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Theme-Style compatibility matrix
CREATE TABLE theme_style_combinations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  theme_id UUID REFERENCES themes(id) ON DELETE CASCADE,
  style_id UUID REFERENCES styles(id) ON DELETE CASCADE,
  compatibility_score INTEGER DEFAULT 5, -- 1-10, how well they work together
  custom_prompt_adjustments TEXT, -- Special prompt modifications for this combo
  example_tags TEXT[], -- Suggested tags for this combination
  is_recommended BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(theme_id, style_id)
);

-- Prompt templates for generating final prompts
CREATE TABLE prompt_templates (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  template TEXT NOT NULL, -- The actual prompt template with placeholders
  variables JSONB NOT NULL, -- {"breed": "required", "theme": "required", "style": "optional"}
  ai_platform TEXT NOT NULL DEFAULT 'midjourney', -- midjourney, dall-e, stable-diffusion
  version TEXT DEFAULT 'v1',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Generated prompts history (for tracking what works)
CREATE TABLE generated_prompts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  breed_id UUID REFERENCES breeds(id),
  theme_id UUID REFERENCES themes(id),
  style_id UUID REFERENCES styles(id),
  format_id UUID REFERENCES formats(id),
  template_id UUID REFERENCES prompt_templates(id),
  final_prompt TEXT NOT NULL,
  generation_parameters JSONB DEFAULT '{}',
  quality_rating INTEGER, -- 1-10 rating of results
  notes TEXT,
  generated_image_urls TEXT[], -- URLs of generated images
  is_approved BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- =============================================================================
-- INDEXES FOR PERFORMANCE
-- =============================================================================

CREATE INDEX idx_breeds_active ON breeds(is_active);
CREATE INDEX idx_breeds_popularity ON breeds(popularity_rank);
CREATE INDEX idx_breeds_slug ON breeds(slug);

CREATE INDEX idx_themes_active ON themes(is_active);
CREATE INDEX idx_themes_seasonal ON themes USING gin(seasonal_relevance);
CREATE INDEX idx_themes_slug ON themes(slug);

CREATE INDEX idx_styles_active ON styles(is_active);
CREATE INDEX idx_styles_slug ON styles(slug);

CREATE INDEX idx_formats_active ON formats(is_active);
CREATE INDEX idx_formats_use_case ON formats(use_case);
CREATE INDEX idx_formats_slug ON formats(slug);

CREATE INDEX idx_generated_prompts_approved ON generated_prompts(is_approved);
CREATE INDEX idx_generated_prompts_rating ON generated_prompts(quality_rating);
CREATE INDEX idx_generated_prompts_breed ON generated_prompts(breed_id);
CREATE INDEX idx_generated_prompts_theme ON generated_prompts(theme_id);

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

-- Enable Row Level Security
ALTER TABLE breeds ENABLE ROW LEVEL SECURITY;
ALTER TABLE themes ENABLE ROW LEVEL SECURITY;
ALTER TABLE styles ENABLE ROW LEVEL SECURITY;
ALTER TABLE formats ENABLE ROW LEVEL SECURITY;
ALTER TABLE theme_style_combinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_prompts ENABLE ROW LEVEL SECURITY;

-- Public read access to active definitions
CREATE POLICY "Allow public read access to active breeds" ON breeds
  FOR SELECT USING (is_active = true);

CREATE POLICY "Allow public read access to active themes" ON themes
  FOR SELECT USING (is_active = true);

CREATE POLICY "Allow public read access to active styles" ON styles
  FOR SELECT USING (is_active = true);

CREATE POLICY "Allow public read access to active formats" ON formats
  FOR SELECT USING (is_active = true);

CREATE POLICY "Allow public read access to theme-style combinations" ON theme_style_combinations
  FOR SELECT USING (true);

CREATE POLICY "Allow public read access to active prompt templates" ON prompt_templates
  FOR SELECT USING (is_active = true);

-- Admin-only write access (adjust these based on your auth setup)
CREATE POLICY "Allow admin full access to breeds" ON breeds
  FOR ALL USING (true);

CREATE POLICY "Allow admin full access to themes" ON themes
  FOR ALL USING (true);

CREATE POLICY "Allow admin full access to styles" ON styles
  FOR ALL USING (true);

CREATE POLICY "Allow admin full access to formats" ON formats
  FOR ALL USING (true);

CREATE POLICY "Allow admin full access to combinations" ON theme_style_combinations
  FOR ALL USING (true);

CREATE POLICY "Allow admin full access to templates" ON prompt_templates
  FOR ALL USING (true);

CREATE POLICY "Allow admin full access to generated prompts" ON generated_prompts
  FOR ALL USING (true);

-- =============================================================================
-- TRIGGERS FOR AUTO-UPDATING TIMESTAMPS
-- =============================================================================

-- Create update trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers to all tables
CREATE TRIGGER update_breeds_updated_at 
  BEFORE UPDATE ON breeds 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_themes_updated_at 
  BEFORE UPDATE ON themes 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_styles_updated_at 
  BEFORE UPDATE ON styles 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_formats_updated_at 
  BEFORE UPDATE ON formats 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_prompt_templates_updated_at 
  BEFORE UPDATE ON prompt_templates 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- INITIAL DATA INSERTION
-- =============================================================================

-- Insert your hilarious breed descriptions
INSERT INTO breeds (name, slug, description, physical_traits, personality_traits, popularity_rank) VALUES

-- Top 5 breeds with your existing descriptions
('Labrador Retriever', 'labrador-retriever', 
'Professional food enthusiasts and part-time vacuum cleaners! Labs have turned "treat motivation" into an art form and can hear a crisp packet opening from three rooms away. They''re the friend who''s always up for an adventure - whether it''s a 10-mile hike or a trip to the garden centre, they''re just happy to be included. Master swimmers who think every puddle is a potential pool, and expert ball retrievers who believe "fetch" is less of a game and more of a life calling.',
'{"size": "large", "coat": "short", "typical_colors": ["yellow", "black", "chocolate"]}',
ARRAY['friendly', 'outgoing', 'active', 'food-motivated'],
1),

('Golden Retriever', 'golden-retriever',
'The eternal optimists of the dog world! Golden Retrievers believe every day is the best day ever, every person is their new best friend, and every meal might just be the most delicious thing they''ve ever tasted (even if it''s the same kibble they had yesterday). Whether they''re "helping" with the laundry by stealing socks, perfecting their innocent "I definitely didn''t eat your sandwich" face, or turning a simple walk into a full-body wiggle parade, Goldens live life with boundless joy and zero personal space boundaries.',
'{"size": "large", "coat": "long", "typical_colors": ["golden", "cream", "light golden"]}',
ARRAY['gentle', 'intelligent', 'friendly', 'optimistic'],
2),

('German Shepherd', 'german-shepherd',
'The responsible ones who take themselves very seriously (until it''s dinner time). German Shepherds are the friends who always have their life together, remember everyone''s birthday, and somehow manage to look noble even when they''re doing something silly. They''ve appointed themselves as Chief Security Officer of the household, which mainly involves suspicious glaring at delivery drivers and extensive sniffing investigations of any new visitors. Despite their serious demeanor, they''re secret softies who turn into gentle giants around children.',
'{"size": "large", "coat": "medium", "typical_colors": ["black and tan", "solid black", "sable"]}',
ARRAY['confident', 'courageous', 'versatile', 'noble'],
3),

('French Bulldog', 'french-bulldog',
'Tiny comedians with big personalities and even bigger attitudes! Frenchies are the class clowns who think they''re much larger than they actually are. They''ve perfected the art of dramatic sighing, selective hearing (especially when it comes to bedtime), and the "cute head tilt" that gets them out of trouble every single time. These little charmers believe every piece of furniture was specifically designed for their comfort, preferably with a human attached for optimal snuggling.',
'{"size": "small", "coat": "short", "typical_colors": ["fawn", "brindle", "white", "black"]}',
ARRAY['affectionate', 'playful', 'alert', 'dramatic'],
4),

('Bulldog', 'bulldog',
'Professional couch warmers who''ve mastered the art of looking dignified while drooling. Bulldogs are the zen masters of the dog world, believing that life is too short to rush anywhere. They''ve perfected the "selective hearing" technique, especially when it comes to exercise suggestions, and have appointed themselves as Chief Nap Officers of the household. These wrinkly philosophers think every problem can be solved with a good snooze.',
'{"size": "medium", "coat": "short", "typical_colors": ["fawn", "white", "brindle", "red"]}',
ARRAY['calm', 'courageous', 'friendly', 'dignified'],
5),

-- Additional popular breeds (without full descriptions for now)
('Poodle', 'poodle',
'Intelligent sophisticates who know they''re fabulous and aren''t afraid to show it! Poodles are the friends with impeccable style who somehow never have a hair out of place, even after a muddy walk.',
'{"size": "varies", "coat": "curly", "typical_colors": ["black", "white", "brown", "apricot"]}',
ARRAY['intelligent', 'active', 'elegant', 'trainable'],
6),

('Beagle', 'beagle',
'Professional treat detectives with PhD degrees in Selective Hearing! Beagles live their lives following their noses, which has led them on many unsanctioned adventures and "investigations" around the neighborhood.',
'{"size": "medium", "coat": "short", "typical_colors": ["tricolor", "lemon", "red and white"]}',
ARRAY['curious', 'friendly', 'determined', 'vocal'],
7),

('Rottweiler', 'rottweiler',
'Gentle giants with hearts of gold and the protective instincts of professional bodyguards. Rottweilers are the friends who look intimidating but are actually secret softies who cry during romantic comedies.',
'{"size": "large", "coat": "short", "typical_colors": ["black and tan"]}',
ARRAY['loyal', 'loving', 'confident', 'protective'],
8),

('Yorkshire Terrier', 'yorkshire-terrier',
'Pocket-sized personalities with the confidence of dogs ten times their size! Yorkies are convinced they''re actually German Shepherds who just happen to be travel-sized for convenience.',
'{"size": "small", "coat": "long", "typical_colors": ["blue and tan"]}',
ARRAY['feisty', 'energetic', 'brave', 'determined'],
9),

('Dachshund', 'dachshund',
'Low-riding comedians with high opinions of themselves! Dachshunds are convinced that their unique body shape is actually a design feature that makes them superior at everything.',
'{"size": "small", "coat": "varies", "typical_colors": ["black and tan", "red", "cream"]}',
ARRAY['playful', 'devoted', 'brave', 'stubborn'],
10),

('Corgi', 'corgi',
'Short-legged comedians who think they''re professional herding consultants! Corgis are convinced their compact legs and big personalities make them natural supervisors who should be organizing everyone.',
'{"size": "medium", "coat": "medium", "typical_colors": ["red", "sable", "tricolor"]}',
ARRAY['intelligent', 'active', 'bold', 'friendly'],
11),

('Border Collie', 'border-collie',
'Professional overthinkers who''ve probably already solved tomorrow''s problems! Border Collies are the friends who finish crossword puzzles in ink and have backup plans for their backup plans.',
'{"size": "medium", "coat": "medium", "typical_colors": ["black and white", "red and white", "tricolor"]}',
ARRAY['intelligent', 'energetic', 'responsive', 'alert'],
12);

-- Insert core themes
INSERT INTO themes (name, slug, description, base_prompt_template, style_keywords, seasonal_relevance, sort_order) VALUES

('Christmas', 'christmas',
'Festive holiday portraits with Santa hats, Christmas trees, and holiday decorations',
'{breed_description} wearing Santa hat and red velvet suit, sitting by Christmas tree wrapping presents with ribbon and bow, cozy living room with fireplace in background, warm golden Christmas lights twinkling, gift boxes scattered around, holiday decorations, family Christmas morning atmosphere',
ARRAY['festive', 'holiday', 'seasonal', 'christmas', 'santa', 'cozy'],
'{"peak_months": [11, 12], "good_months": [10], "off_season": [6, 7, 8]}',
1),

('Sports', 'sports',
'Team jerseys, stadium settings, and sports fan themes',
'{breed_description} wearing Manchester United red jersey with scarf, sitting in stadium seat holding a foam finger, excited expression with mouth open, Old Trafford stadium background slightly blurred, match day atmosphere with crowd in background, professional sports photography style, bright stadium lighting, team colors prominent, celebratory pose',
ARRAY['sports', 'team', 'athletic', 'energetic', 'fan', 'stadium'],
'{"peak_months": [9, 10, 3, 4], "good_months": [11, 12, 1, 2, 5]}',
2),

('Professional', 'professional',
'Business suits, office settings, and corporate themes',
'{breed_description} wearing business suit and tie sitting behind executive desk in modern office, paws on desk with laptop and coffee cup, city skyline visible through large windows, professional corporate headshot style, confident business expression, expensive office furniture, success and leadership theme',
ARRAY['business', 'professional', 'corporate', 'executive', 'office', 'suit'],
'{"peak_months": [1, 2, 9, 10], "good_months": [3, 4, 5, 11]}',
3),

('Birthday', 'birthday',
'Party hats, birthday cakes, and celebration themes',
'{breed_description} wearing colorful birthday party hat sitting at table with birthday cake in front, blowing out candles, party decorations with balloons in background, "Happy Birthday" banner, confetti scattered on table, party plates and napkins, joyful celebration atmosphere',
ARRAY['birthday', 'celebration', 'party', 'festive', 'cake', 'balloons'],
'{"peak_months": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]}',
4),

('Toilet Humor', 'toilet-humor',
'Cheeky bathroom scenes with pajamas and smartphones',
'{breed_description} sitting on a white toilet, wearing blue cotton pajamas, holding a smartphone in its paws, looking directly at camera with cheeky expression, bathroom setting with white tiles, flowers in vase in background, natural lighting, shot from slightly below eye level, detailed fur texture, anthropomorphic pose, humorous concept',
ARRAY['humor', 'funny', 'cheeky', 'bathroom', 'relatable', 'meme'],
'{"peak_months": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]}',
5),

('Paris Vacation', 'paris',
'Romantic Parisian café scenes with berets and Eiffel Tower',
'{breed_description} wearing classic French beret and navy blue striped shirt sitting at charming Parisian sidewalk café terrace, delicately holding fresh croissant in paws, steaming café au lait on vintage bistro table, iconic Eiffel Tower majestically rising in soft-focus background, classic Parisian cobblestone street with traditional Haussmann architecture, warm golden hour lighting',
ARRAY['paris', 'france', 'vacation', 'travel', 'cafe', 'romantic'],
'{"peak_months": [4, 5, 6, 7, 8, 9], "good_months": [3, 10]}',
6);

-- Insert core styles
INSERT INTO styles (name, slug, description, prompt_suffix, technical_parameters, sort_order) VALUES

('Realistic', 'realistic',
'Photorealistic style with natural lighting and detailed textures',
', professional photography, highly detailed, cinematic lighting, award winning photo, masterpiece, ultra realistic, 8k quality, perfect composition',
'{"aspect_ratio": "4:5", "style_weight": 0.9, "quality": "high"}',
1),

('Midjourney Style', 'midjourney',
'Optimized for Midjourney AI with signature aesthetic',
', in the style of midjourney, highly detailed, cinematic lighting, professional photography, vibrant colors, perfect composition, ultra realistic',
'{"aspect_ratio": "4:5", "midjourney_version": "6", "quality": "high"}',
2),

('Artistic', 'artistic',
'Painted or illustrated style with artistic flair',
', digital art, painterly style, artistic interpretation, vibrant colors, creative composition, masterpiece artwork, professional illustration',
'{"aspect_ratio": "4:5", "style_weight": 0.7, "quality": "high"}',
3),

('Vintage', 'vintage',
'Classic, retro style with warm tones and aged appearance',
', vintage photography style, classic portrait, warm sepia tones, aged paper texture, antique aesthetic, timeless composition, nostalgic mood',
'{"aspect_ratio": "4:5", "color_palette": "warm", "texture": "aged"}',
4),

('Cartoon', 'cartoon',
'Fun, animated cartoon style',
', cartoon style, animated character, colorful illustration, fun and playful, digital cartoon art, character design, bright colors',
'{"aspect_ratio": "4:5", "style_weight": 0.6, "color_saturation": "high"}',
5);

-- Insert essential formats for multi-platform support
INSERT INTO formats (name, slug, description, aspect_ratio, use_case, prompt_adjustments, midjourney_parameters, sort_order) VALUES

('Product Portrait', 'product-portrait', 
'Standard product image for e-commerce and prints', 
'4:5', 'product', 
'centered composition, product photography style, clean background', 
'--ar 4:5 --style raw --v 6', 1),

('Instagram Post', 'instagram-post',
'Square format optimized for Instagram feed',
'1:1', 'social',
'square composition, social media optimized, engaging visual',
'--ar 1:1 --style raw --v 6', 2),

('Instagram Story', 'instagram-story',
'Vertical format for Instagram/TikTok stories',
'9:16', 'story',
'vertical composition, mobile-first design, story-friendly layout',
'--ar 9:16 --style raw --v 6', 3),

('YouTube Thumbnail', 'youtube-thumbnail',
'Landscape format for video thumbnails',
'16:9', 'thumbnail',
'thumbnail style, eye-catching composition, bold design, high contrast',
'--ar 16:9 --style raw --v 6', 4),

('Website Banner', 'website-banner',
'Wide banner format for website headers',
'16:9', 'banner',
'wide composition, landscape orientation, banner style, text space consideration',
'--ar 16:9 --style raw --v 6', 5),

('Print Poster', 'print-poster',
'High-resolution format for large prints',
'2:3', 'print',
'print-ready composition, high detail, poster layout',
'--ar 2:3 --style raw --v 6 --q 2', 6),

('Email Header', 'email-header',
'Wide format for email marketing headers',
'3:1', 'email',
'email header composition, wide banner style, marketing focused',
'--ar 3:1 --style raw --v 6', 7);

-- Insert default prompt template
INSERT INTO prompt_templates (name, description, template, variables, ai_platform) VALUES

('Midjourney Standard', 
'Standard Midjourney prompt template with breed, theme, style, and format',
'{base_prompt}{style_suffix}{format_adjustments} {midjourney_parameters}',
'{"breed_description": "required", "base_prompt": "required", "style_suffix": "required", "format_adjustments": "optional", "midjourney_parameters": "required"}',
'midjourney'),

('Simple Template', 
'Basic template for testing',
'{base_prompt}{style_suffix} --ar {aspect_ratio} --style raw --v 6',
'{"base_prompt": "required", "style_suffix": "required", "aspect_ratio": "required"}',
'midjourney');

-- Insert some theme-style combinations for better results
INSERT INTO theme_style_combinations (theme_id, style_id, compatibility_score, is_recommended) 
SELECT t.id, s.id, 9, true
FROM themes t, styles s 
WHERE t.slug = 'christmas' AND s.slug = 'realistic';

INSERT INTO theme_style_combinations (theme_id, style_id, compatibility_score, is_recommended)
SELECT t.id, s.id, 9, true  
FROM themes t, styles s
WHERE t.slug = 'christmas' AND s.slug = 'midjourney';

INSERT INTO theme_style_combinations (theme_id, style_id, compatibility_score, is_recommended)
SELECT t.id, s.id, 8, true
FROM themes t, styles s  
WHERE t.slug = 'sports' AND s.slug = 'realistic';

INSERT INTO theme_style_combinations (theme_id, style_id, compatibility_score, is_recommended)
SELECT t.id, s.id, 9, true
FROM themes t, styles s  
WHERE t.slug = 'professional' AND s.slug = 'realistic';

INSERT INTO theme_style_combinations (theme_id, style_id, compatibility_score, is_recommended)
SELECT t.id, s.id, 7, true
FROM themes t, styles s  
WHERE t.slug = 'toilet-humor' AND s.slug = 'realistic';

INSERT INTO theme_style_combinations (theme_id, style_id, compatibility_score, is_recommended)
SELECT t.id, s.id, 8, true
FROM themes t, styles s  
WHERE t.slug = 'paris' AND s.slug = 'artistic';

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================

-- Verify the setup worked correctly
DO $$
DECLARE
    breed_count INTEGER;
    theme_count INTEGER;
    style_count INTEGER;
    format_count INTEGER;
    template_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO breed_count FROM breeds WHERE is_active = true;
    SELECT COUNT(*) INTO theme_count FROM themes WHERE is_active = true;
    SELECT COUNT(*) INTO style_count FROM styles WHERE is_active = true;
    SELECT COUNT(*) INTO format_count FROM formats WHERE is_active = true;
    SELECT COUNT(*) INTO template_count FROM prompt_templates WHERE is_active = true;
    
    RAISE NOTICE '=============================================================================';
    RAISE NOTICE 'PAWTRAITS DATABASE SETUP COMPLETE!';
    RAISE NOTICE '=============================================================================';
    RAISE NOTICE 'Active Breeds: %', breed_count;
    RAISE NOTICE 'Active Themes: %', theme_count;
    RAISE NOTICE 'Active Styles: %', style_count;
    RAISE NOTICE 'Active Formats: %', format_count;
    RAISE NOTICE 'Active Templates: %', template_count;
    RAISE NOTICE 'Total Possible Combinations: %', breed_count * theme_count * style_count * format_count * 2; -- *2 for genders
    RAISE NOTICE '=============================================================================';
    RAISE NOTICE 'Next Steps:';
    RAISE NOTICE '1. Test CLI: npx tsx scripts/enhanced-generate-prompts.ts list';
    RAISE NOTICE '2. Access Admin: http://localhost:3000/admin/definitions';
    RAISE NOTICE '3. Generate Test: npx tsx scripts/enhanced-generate-prompts.ts test';
    RAISE NOTICE '=============================================================================';
END $$;

-- Display sample data for verification
SELECT 'BREEDS' as table_name, name, slug, popularity_rank, is_active 
FROM breeds 
ORDER BY popularity_rank 
LIMIT 5;

SELECT 'THEMES' as table_name, name, slug, sort_order, is_active 
FROM themes 
ORDER BY sort_order 
LIMIT 5;

SELECT 'STYLES' as table_name, name, slug, sort_order, is_active 
FROM styles 
ORDER BY sort_order 
LIMIT 5;

SELECT 'FORMATS' as table_name, name, slug, aspect_ratio, use_case, is_active 
FROM formats 
ORDER BY sort_order 
LIMIT 5;