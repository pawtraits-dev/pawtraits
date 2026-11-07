-- =============================================================================
-- Market stock gaps (Nov 2026): moggy cats and four London-favourite dog breeds,
-- their coats, and two saved variation batches ready to run.
-- Safe to re-run. The six new coats (Brown Tabby, Ginger Tabby, Tuxedo, Blenheim,
-- Apricot, Salt and Pepper) were added on 7 Nov; they're re-asserted here.
-- After running: Admin → Variation Batches → run each saved batch on its references
-- (listed in the batch description).
-- =============================================================================
BEGIN;

-- Coats (no-op if already there)
INSERT INTO public.coats (name, slug, animal_type, hex_color, pattern_type, rarity, is_active, description) VALUES
  ('Brown Tabby', 'brown-tabby', 'cat', '#8B6A45', 'tabby', 'common', true, 'Brown tabby: dark brown stripes on a warm brown coat, the classic British moggy'),
  ('Ginger Tabby', 'ginger-tabby', 'cat', '#D2874A', 'tabby', 'common', true, 'Ginger (orange/red) tabby with darker ginger stripes'),
  ('Tuxedo', 'tuxedo', 'cat', '#1E1E1E', 'bicolor', 'common', true, 'Black coat with a white chest, white paws and often a white muzzle, like a dinner jacket'),
  ('Blenheim', 'blenheim', 'dog', '#B4652F', 'bicolor', 'common', true, 'Rich chestnut markings on a pearly white coat (Cavalier King Charles Spaniel)'),
  ('Apricot', 'apricot', 'dog', '#E3A869', 'solid', 'common', true, 'Warm apricot, between cream and red (doodles and poodles)'),
  ('Salt and Pepper', 'salt-and-pepper', 'dog', '#8E8E8E', 'grizzle', 'common', true, 'Banded black and white hairs giving an even pepper-grey coat with paler beard and eyebrows (Schnauzer)')
ON CONFLICT (name) DO NOTHING;

-- New breeds
INSERT INTO public.breeds (name, slug, animal_type, description, physical_traits, personality_traits, alternative_names, is_active, metadata) VALUES
  ('Domestic Shorthair', 'domestic-shorthair', 'cat',
   E'**The original house cat: no pedigree, all personality!**\n\nDomestic shorthairs, the nation''s beloved moggies, come in every colour going and run the household as their personal kingdom. They''ve perfected the art of ignoring you until the exact moment you sit down, then claiming your lap as if by royal decree. Equal parts fearless hunter and professional sunbeam inspector, they''re living proof that the best things in life don''t come with paperwork.',
   '{"coat":"short","size":"medium"}', ARRAY['Independent','Affectionate','Curious','Adaptable'], ARRAY['Moggy','Moggie','House Cat','Domestic Shorthair Cat'], true, '{}'),
  ('Labradoodle', 'labradoodle', 'dog',
   E'**Teddy bears with a Labrador''s appetite and a Poodle''s brain!**\n\nLabradoodles have combined the Lab''s boundless enthusiasm with the Poodle''s cleverness, producing curly-coated charmers who greet every visitor like a long-lost friend. They''re equally happy splashing through the muddiest puddle in the park and then shaking it all over your sofa. Eternal optimists, they firmly believe every pocket contains a biscuit and every stranger is a best friend waiting to happen.',
   '{"coat":"curly","size":"medium-large"}', ARRAY['Friendly','Clever','Energetic','Sociable'], ARRAY['Doodle','Australian Labradoodle'], true, '{}'),
  ('Cavalier King Charles Spaniel', 'cavalier-king-charles-spaniel', 'dog',
   E'**Professional lap-warmers with the soulful eyes of a royal portrait!**\n\nCavaliers have been charming their way onto aristocratic cushions for centuries, and they see no reason to lower their standards now. With silky ears and melting eyes, they can secure a second breakfast with a single look. Devoted shadows, they follow their favourite human from room to room, just in case something exciting (or edible) happens without them.',
   '{"coat":"silky","size":"small"}', ARRAY['Affectionate','Gentle','Devoted','Playful'], ARRAY['Cavalier','Cavalier King Charles','CKCS'], true, '{}'),
  ('Miniature Schnauzer', 'miniature-schnauzer', 'dog',
   E'**Distinguished gentlemen with eyebrows and opinions to match!**\n\nMiniature Schnauzers sport the finest moustache in dogdom and carry themselves like a retired colonel inspecting the troops. They take neighbourhood watch duties extremely seriously, reporting every postman, pigeon and passing leaf with great urgency. Behind the gruff whiskers beats the heart of a loyal clown who lives to make the family laugh.',
   '{"coat":"wiry","size":"small"}', ARRAY['Alert','Spirited','Loyal','Funny'], ARRAY['Schnauzer','Mini Schnauzer'], true, '{}')
ON CONFLICT (name) DO NOTHING;

-- Staffie: singular name and a real description (it had "NA")
UPDATE public.breeds SET
  name = 'Staffordshire Bull Terrier',
  alternative_names = ARRAY['Staffie','Staffy','Staffordshire Bull Terriers'],
  personality_traits = ARRAY['Affectionate','Brave','Loyal','Playful'],
  physical_traits = '{"coat":"short","size":"medium"}',
  description = E'**Big-hearted smilers built like tiny bodybuilders!**\n\nStaffies may look like they spend every morning at the gym, but under all that muscle is the softest soul in the dog world. Famous for their enormous grins and whole-body wags, they treat every visitor as a guest of honour and every lap as a seat reserved just for them. Loyal, fun-loving and endlessly affectionate, they''re living proof that you should never judge a dog by its biceps.',
  updated_at = now()
WHERE name = 'Staffordshire Bull Terriers';

-- Short names for "the Staffie will see you shortly" (column from 2026-10-23-picture-words)
UPDATE public.breeds SET short_name = 'Moggy'     WHERE name = 'Domestic Shorthair';
UPDATE public.breeds SET short_name = 'Cavalier'  WHERE name = 'Cavalier King Charles Spaniel';
UPDATE public.breeds SET short_name = 'Schnauzer' WHERE name = 'Miniature Schnauzer';
UPDATE public.breeds SET short_name = 'Staffie'   WHERE name = 'Staffordshire Bull Terrier';

-- Which coats each breed comes in
INSERT INTO public.breed_coats (breed_id, coat_id, is_common, is_standard, popularity_rank)
SELECT b.id, c.id, true, true, x.rank
FROM (VALUES
  ('Domestic Shorthair', 'Brown Tabby', 1), ('Domestic Shorthair', 'Ginger Tabby', 2), ('Domestic Shorthair', 'Solid Black', 3),
  ('Domestic Shorthair', 'Tuxedo', 4), ('Domestic Shorthair', 'Gray / Blue', 5), ('Domestic Shorthair', 'Tortoiseshell', 6),
  ('Domestic Shorthair', 'Calico', 7), ('Domestic Shorthair', 'Solid White', 8),
  ('Labradoodle', 'Apricot', 1), ('Labradoodle', 'Brown', 2), ('Labradoodle', 'Black', 3), ('Labradoodle', 'Cream', 4),
  ('Cavalier King Charles Spaniel', 'Blenheim', 1), ('Cavalier King Charles Spaniel', 'Tri-color', 2), ('Cavalier King Charles Spaniel', 'Red', 3),
  ('Miniature Schnauzer', 'Salt and Pepper', 1), ('Miniature Schnauzer', 'Black', 2),
  ('Staffordshire Bull Terrier', 'Brindle', 1), ('Staffordshire Bull Terrier', 'Blue', 2), ('Staffordshire Bull Terrier', 'Black and White', 3),
  ('Staffordshire Bull Terrier', 'Fawn', 4)
) AS x(breed, coat, rank)
JOIN public.breeds b ON b.name = x.breed
JOIN public.coats c ON c.name = x.coat AND c.animal_type = b.animal_type
WHERE NOT EXISTS (SELECT 1 FROM public.breed_coats bc WHERE bc.breed_id = b.id AND bc.coat_id = c.id);

-- Saved variation batches (2K, Gemini batch prices)
INSERT INTO public.variation_recipes (name, description, breed_coats, image_size)
SELECT 'Market gaps: moggy cats',
  'Gap 1. Run on: Please Be Seated – Feline Overlord; You Only Live Nine Times (Secret Agent Cat); Cozy Christmas Kitten in Holiday Knitwear; Cozy Kitten''s Christmas Cardigan Moment; The Best Gift? Clearly This Ginger Kitten!; The Lap Monarch; Coffee-Loving Kitty''s Morning Bliss; The Hot Gossip (British Shorthair). 6 per design.',
  jsonb_agg(jsonb_build_object('breedId', b.id, 'coatId', c.id) ORDER BY x.ord), '2K'
FROM (VALUES ('Brown Tabby', 1), ('Ginger Tabby', 2), ('Solid Black', 3), ('Tuxedo', 4), ('Gray / Blue', 5), ('Tortoiseshell', 6)) AS x(coat, ord)
JOIN public.breeds b ON b.name = 'Domestic Shorthair'
JOIN public.coats c ON c.name = x.coat AND c.animal_type = 'cat'
HAVING NOT EXISTS (SELECT 1 FROM public.variation_recipes WHERE name = 'Market gaps: moggy cats');

INSERT INTO public.variation_recipes (name, description, breed_coats, image_size)
SELECT 'Market gaps: Staffie, Cavalier, Labradoodle, Schnauzer',
  'Gap 3. Run on: Yorkshire Terrier''s Renaissance Royalty Moment; Dachshund''s Noble Field Portrait; The Most Interesting Dog in the World; Bubble Bath Blues with a Very Patient Pooch; Please Be Seated – The Doodle Will See You Shortly; Spaniel''s Sunset Beach Masterpiece; Cockapoo''s Charming Peek-a-Boo Portrait. 9 per design.',
  jsonb_agg(jsonb_build_object('breedId', b.id, 'coatId', c.id) ORDER BY x.ord), '2K'
FROM (VALUES
  ('Staffordshire Bull Terrier', 'Brindle', 1), ('Staffordshire Bull Terrier', 'Blue', 2), ('Staffordshire Bull Terrier', 'Black and White', 3),
  ('Cavalier King Charles Spaniel', 'Blenheim', 4), ('Cavalier King Charles Spaniel', 'Tri-color', 5),
  ('Labradoodle', 'Apricot', 6), ('Labradoodle', 'Brown', 7), ('Labradoodle', 'Black', 8),
  ('Miniature Schnauzer', 'Salt and Pepper', 9)
) AS x(breed, coat, ord)
JOIN public.breeds b ON b.name = x.breed
JOIN public.coats c ON c.name = x.coat AND c.animal_type = b.animal_type
HAVING NOT EXISTS (SELECT 1 FROM public.variation_recipes WHERE name = 'Market gaps: Staffie, Cavalier, Labradoodle, Schnauzer');

COMMIT;

-- Check: both batches should list their combinations
-- SELECT name, jsonb_array_length(breed_coats) FROM public.variation_recipes WHERE name LIKE 'Market gaps%';
