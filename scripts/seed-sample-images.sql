-- Sample data for testing the customer homepage sections
-- This creates test images for Popular, New, Featured, and Recommended sections

-- First, let's get some sample breed, theme, style, and format IDs
-- (We'll use the first few available from each table)

-- Insert sample images for testing
INSERT INTO image_catalog (
    original_filename,
    public_url,
    description,
    prompt_text,
    ai_model,
    breed_id,
    theme_id,
    style_id,
    rating,
    is_featured,
    is_public,
    like_count,
    view_count,
    tags,
    created_at
) VALUES
-- Popular images (high like counts)
(
    'golden_retriever_portrait_1.jpg',
    'https://images.unsplash.com/photo-1552053831-71594a27632d?w=400',
    'Beautiful Golden Retriever portrait with warm lighting',
    'A majestic golden retriever sitting in a park, professional photography, warm golden hour lighting, detailed fur texture',
    'Midjourney v6',
    (SELECT id FROM breeds WHERE name ILIKE '%golden%' LIMIT 1),
    (SELECT id FROM themes WHERE name ILIKE '%classic%' OR name ILIKE '%portrait%' LIMIT 1),
    (SELECT id FROM styles WHERE name ILIKE '%realistic%' OR name ILIKE '%photo%' LIMIT 1),
    5,
    false,
    true,
    47,
    156,
    ARRAY['golden retriever', 'portrait', 'warm lighting', 'professional'],
    NOW() - INTERVAL '15 days'
),
(
    'husky_winter_portrait.jpg',
    'https://images.unsplash.com/photo-1605568427561-40dd23c2acea?w=400',
    'Siberian Husky in winter wonderland setting',
    'Siberian husky with piercing blue eyes, snow background, winter portrait, detailed fur',
    'Midjourney v6',
    (SELECT id FROM breeds WHERE name ILIKE '%husky%' OR name ILIKE '%siberian%' LIMIT 1),
    (SELECT id FROM themes WHERE name ILIKE '%winter%' OR name ILIKE '%nature%' LIMIT 1),
    (SELECT id FROM styles WHERE name ILIKE '%realistic%' LIMIT 1),
    5,
    false,
    true,
    38,
    203,
    ARRAY['husky', 'winter', 'blue eyes', 'snow'],
    NOW() - INTERVAL '20 days'
),
(
    'labrador_family_portrait.jpg',
    'https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=400',
    'Friendly Labrador family portrait',
    'Happy labrador retriever family, mother and puppies, heartwarming scene, soft lighting',
    'DALL-E 3',
    (SELECT id FROM breeds WHERE name ILIKE '%labrador%' LIMIT 1),
    (SELECT id FROM themes WHERE name ILIKE '%family%' OR name ILIKE '%classic%' LIMIT 1),
    (SELECT id FROM styles WHERE name ILIKE '%warm%' OR name ILIKE '%realistic%' LIMIT 1),
    4,
    false,
    true,
    35,
    178,
    ARRAY['labrador', 'family', 'puppies', 'heartwarming'],
    NOW() - INTERVAL '12 days'
),
(
    'border_collie_action.jpg',
    'https://images.unsplash.com/photo-1551717743-49959800b1f6?w=400',
    'Border Collie in action shot',
    'Border collie running through a field, dynamic action shot, motion blur background, energetic',
    'Midjourney v6',
    (SELECT id FROM breeds WHERE name ILIKE '%border%' OR name ILIKE '%collie%' LIMIT 1),
    (SELECT id FROM themes WHERE name ILIKE '%action%' OR name ILIKE '%outdoor%' LIMIT 1),
    (SELECT id FROM styles WHERE name ILIKE '%dynamic%' OR name ILIKE '%realistic%' LIMIT 1),
    4,
    false,
    true,
    29,
    145,
    ARRAY['border collie', 'action', 'running', 'field'],
    NOW() - INTERVAL '18 days'
),

-- New images (recent dates)
(
    'french_bulldog_modern.jpg',
    'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?w=400',
    'Modern French Bulldog portrait with urban backdrop',
    'French bulldog with urban city backdrop, modern portrait style, shallow depth of field',
    'Midjourney v6',
    (SELECT id FROM breeds WHERE name ILIKE '%french%' OR name ILIKE '%bulldog%' LIMIT 1),
    (SELECT id FROM themes WHERE name ILIKE '%modern%' OR name ILIKE '%urban%' LIMIT 1),
    (SELECT id FROM styles WHERE name ILIKE '%modern%' OR name ILIKE '%contemporary%' LIMIT 1),
    4,
    false,
    true,
    12,
    67,
    ARRAY['french bulldog', 'urban', 'modern', 'city'],
    NOW() - INTERVAL '2 days'
),
(
    'german_shepherd_hero.jpg',
    'https://images.unsplash.com/photo-1589941013453-ec89f33b5e95?w=400',
    'Heroic German Shepherd portrait',
    'German shepherd in heroic pose, dramatic lighting, professional K9 portrait style',
    'DALL-E 3',
    (SELECT id FROM breeds WHERE name ILIKE '%german%' OR name ILIKE '%shepherd%' LIMIT 1),
    (SELECT id FROM themes WHERE name ILIKE '%heroic%' OR name ILIKE '%professional%' LIMIT 1),
    (SELECT id FROM styles WHERE name ILIKE '%dramatic%' OR name ILIKE '%professional%' LIMIT 1),
    5,
    false,
    true,
    8,
    43,
    ARRAY['german shepherd', 'heroic', 'dramatic', 'K9'],
    NOW() - INTERVAL '1 day'
),
(
    'corgi_playful_portrait.jpg',
    'https://images.unsplash.com/photo-1612198188060-c7c2a3b66eae?w=400',
    'Playful Corgi with tongue out',
    'Adorable corgi with tongue out, playful expression, bright natural lighting, joyful mood',
    'Midjourney v6',
    (SELECT id FROM breeds WHERE name ILIKE '%corgi%' LIMIT 1),
    (SELECT id FROM themes WHERE name ILIKE '%playful%' OR name ILIKE '%fun%' LIMIT 1),
    (SELECT id FROM styles WHERE name ILIKE '%bright%' OR name ILIKE '%cheerful%' LIMIT 1),
    4,
    false,
    true,
    15,
    89,
    ARRAY['corgi', 'playful', 'tongue', 'joyful'],
    NOW() - INTERVAL '3 days'
),
(
    'beagle_garden_portrait.jpg',
    'https://images.unsplash.com/photo-1618330876892-3b9c7738a15d?w=400',
    'Beagle in beautiful garden setting',
    'Beagle sitting in a flower garden, spring portrait, natural lighting, peaceful mood',
    'DALL-E 3',
    (SELECT id FROM breeds WHERE name ILIKE '%beagle%' LIMIT 1),
    (SELECT id FROM themes WHERE name ILIKE '%garden%' OR name ILIKE '%nature%' LIMIT 1),
    (SELECT id FROM styles WHERE name ILIKE '%natural%' OR name ILIKE '%peaceful%' LIMIT 1),
    4,
    false,
    true,
    9,
    52,
    ARRAY['beagle', 'garden', 'flowers', 'spring'],
    NOW() - INTERVAL '1 day'
),

-- Featured images (is_featured = true)
(
    'aussie_shepherd_featured.jpg',
    'https://images.unsplash.com/photo-1605568230815-4e23683f0c8f?w=400',
    'Featured Australian Shepherd masterpiece',
    'Australian shepherd with heterochromia, stunning eye detail, award-winning portrait photography',
    'Midjourney v6',
    (SELECT id FROM breeds WHERE name ILIKE '%australian%' OR name ILIKE '%aussie%' LIMIT 1),
    (SELECT id FROM themes WHERE name ILIKE '%masterpiece%' OR name ILIKE '%award%' LIMIT 1),
    (SELECT id FROM styles WHERE name ILIKE '%detailed%' OR name ILIKE '%award%' LIMIT 1),
    5,
    true,
    true,
    67,
    234,
    ARRAY['australian shepherd', 'heterochromia', 'award-winning', 'detailed'],
    NOW() - INTERVAL '8 days'
),
(
    'poodle_elegant_featured.jpg',
    'https://images.unsplash.com/photo-1616190265687-b7ebf7ae17ff?w=400',
    'Elegant Poodle in classical style',
    'Standard poodle with elegant grooming, classical portrait style, sophisticated lighting',
    'DALL-E 3',
    (SELECT id FROM breeds WHERE name ILIKE '%poodle%' LIMIT 1),
    (SELECT id FROM themes WHERE name ILIKE '%elegant%' OR name ILIKE '%classical%' LIMIT 1),
    (SELECT id FROM styles WHERE name ILIKE '%classical%' OR name ILIKE '%sophisticated%' LIMIT 1),
    5,
    true,
    true,
    54,
    198,
    ARRAY['poodle', 'elegant', 'grooming', 'sophisticated'],
    NOW() - INTERVAL '10 days'
),
(
    'rottweiler_noble_featured.jpg',
    'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=400',
    'Noble Rottweiler portrait',
    'Rottweiler with noble expression, regal portrait style, dramatic studio lighting, powerful presence',
    'Midjourney v6',
    (SELECT id FROM breeds WHERE name ILIKE '%rottweiler%' LIMIT 1),
    (SELECT id FROM themes WHERE name ILIKE '%noble%' OR name ILIKE '%regal%' LIMIT 1),
    (SELECT id FROM styles WHERE name ILIKE '%dramatic%' OR name ILIKE '%studio%' LIMIT 1),
    5,
    true,
    true,
    43,
    167,
    ARRAY['rottweiler', 'noble', 'regal', 'powerful'],
    NOW() - INTERVAL '6 days'
),
(
    'dachshund_whimsical_featured.jpg',
    'https://images.unsplash.com/photo-1629549050085-b5ee45334a00?w=400',
    'Whimsical Dachshund portrait',
    'Dachshund in whimsical artistic style, creative composition, playful colors, unique perspective',
    'DALL-E 3',
    (SELECT id FROM breeds WHERE name ILIKE '%dachshund%' OR name ILIKE '%wiener%' LIMIT 1),
    (SELECT id FROM themes WHERE name ILIKE '%whimsical%' OR name ILIKE '%artistic%' LIMIT 1),
    (SELECT id FROM styles WHERE name ILIKE '%whimsical%' OR name ILIKE '%creative%' LIMIT 1),
    4,
    true,
    true,
    31,
    124,
    ARRAY['dachshund', 'whimsical', 'artistic', 'playful'],
    NOW() - INTERVAL '5 days'
);

-- Update the like_count column for popular images to ensure they show up in popular section
UPDATE image_catalog SET like_count = 47 WHERE original_filename = 'golden_retriever_portrait_1.jpg';
UPDATE image_catalog SET like_count = 38 WHERE original_filename = 'husky_winter_portrait.jpg';
UPDATE image_catalog SET like_count = 35 WHERE original_filename = 'labrador_family_portrait.jpg';
UPDATE image_catalog SET like_count = 29 WHERE original_filename = 'border_collie_action.jpg';

-- Add some sample user interaction data
INSERT INTO user_interactions (
    user_id,
    session_id,
    image_id,
    interaction_type,
    created_at
)
SELECT 
    NULL as user_id,
    'sample_session_' || generate_random_uuid()::text as session_id,
    id as image_id,
    'like' as interaction_type,
    created_at + INTERVAL '1 hour' as created_at
FROM image_catalog 
WHERE like_count > 20
LIMIT 10;

-- Success message
SELECT 'Sample image data inserted successfully!' as status,
       COUNT(*) as total_images
FROM image_catalog;