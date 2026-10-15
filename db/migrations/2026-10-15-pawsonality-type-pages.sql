-- =============================================================================
-- Pawsonalities pages: more about each result type
--   about            a longer description for the type's own page
--   famous_examples  breeds / characters that fit the type
--   best_buddies     two compatible type codes (linked on the page)
-- Draft copy for all 32 types is filled in only where empty: edit in Admin → Quizzes →
-- Result types, then publish the quiz for the pages to show it. Safe to re-run.
-- =============================================================================
BEGIN;

ALTER TABLE public.quiz_result_types ADD COLUMN IF NOT EXISTS about text;
ALTER TABLE public.quiz_result_types ADD COLUMN IF NOT EXISTS famous_examples text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.quiz_result_types ADD COLUMN IF NOT EXISTS best_buddies text[] NOT NULL DEFAULT '{}';

-- dogs
UPDATE public.quiz_result_types t SET
  about = COALESCE(t.about, 'Runs on pure possibility. Endless energy, a firm belief that rules are optional and absolutely no fear make for a dog whose next move nobody (including the dog) can predict. One minute it''s zoomies round the garden, the next a solo expedition into the neighbour''s hedge. Exhausting? Occasionally. Boring? Never. They need room to roam, games that change often, and an owner with a sense of humour and a very secure fence.'),
  famous_examples = CASE WHEN cardinality(t.famous_examples) = 0 THEN ARRAY['Siberian Husky', 'Jack Russell Terrier', 'Scooby-Doo']::text[] ELSE t.famous_examples END,
  best_buddies = CASE WHEN cardinality(t.best_buddies) = 0 THEN ARRAY['ESFB', 'ENTB']::text[] ELSE t.best_buddies END
  FROM public.quizzes z WHERE t.quiz_id = z.id AND z.slug = 'pawsonality' AND z.animal_type = 'dog' AND t.code = 'ENFB';
UPDATE public.quiz_result_types t SET
  about = COALESCE(t.about, 'Brave on their own timeline. This dog has energy to burn and a strong independent streak, but anything new gets a long, careful look before they commit. Once they''ve decided it''s safe, they''re all in, tail going like a propeller. Give them time, patience and the occasional gentle nudge, and you''ll find an adventurer hiding behind the caution.'),
  famous_examples = CASE WHEN cardinality(t.famous_examples) = 0 THEN ARRAY['Shiba Inu', 'Whippet', 'Border Terrier']::text[] ELSE t.famous_examples END,
  best_buddies = CASE WHEN cardinality(t.best_buddies) = 0 THEN ARRAY['ISTC', 'ESTC']::text[] ELSE t.best_buddies END
  FROM public.quizzes z WHERE t.quiz_id = z.id AND z.slug = 'pawsonality' AND z.animal_type = 'dog' AND t.code = 'ENFC';
UPDATE public.quiz_result_types t SET
  about = COALESCE(t.about, 'A self-starter with a motor that never switches off. Quick to learn, happy with or without company, and willing to try anything once (twice, if a squirrel was involved). They thrive on having a job: agility, fetch, long hikes, puzzle feeders. Leave them bored and they''ll invent a job of their own, usually involving something you''d rather they didn''t touch.'),
  famous_examples = CASE WHEN cardinality(t.famous_examples) = 0 THEN ARRAY['Border Collie', 'German Shepherd', 'Belgian Malinois']::text[] ELSE t.famous_examples END,
  best_buddies = CASE WHEN cardinality(t.best_buddies) = 0 THEN ARRAY['ENFB', 'ESTB']::text[] ELSE t.best_buddies END
  FROM public.quizzes z WHERE t.quiz_id = z.id AND z.slug = 'pawsonality' AND z.animal_type = 'dog' AND t.code = 'ENTB';
UPDATE public.quiz_result_types t SET
  about = COALESCE(t.about, 'Curious, sociable and thorough. This dog wants to understand everything before joining in: the new visitor, the new bed, the strange noise from the kitchen. Expect long, searching stares and a forensic investigation of every new smell. Once satisfied, they''re warm, engaged company who learn quickly and love a good thinking game.'),
  famous_examples = CASE WHEN cardinality(t.famous_examples) = 0 THEN ARRAY['Bloodhound', 'Basset Hound', 'Poodle']::text[] ELSE t.famous_examples END,
  best_buddies = CASE WHEN cardinality(t.best_buddies) = 0 THEN ARRAY['INTB', 'ESTC']::text[] ELSE t.best_buddies END
  FROM public.quizzes z WHERE t.quiz_id = z.id AND z.slug = 'pawsonality' AND z.animal_type = 'dog' AND t.code = 'ENTC';
UPDATE public.quiz_result_types t SET
  about = COALESCE(t.about, 'First to every activity and last to leave. This dog greets every human and hound like a long-lost friend, has never heard of an indoor voice and treats rules as gentle suggestions. Life with them is loud, joyful and occasionally chaotic. They need plenty of play, plenty of company and, ideally, furniture you''re not too precious about.'),
  famous_examples = CASE WHEN cardinality(t.famous_examples) = 0 THEN ARRAY['Jack Russell Terrier', 'Brittany Spaniel', 'Cocker Spaniel']::text[] ELSE t.famous_examples END,
  best_buddies = CASE WHEN cardinality(t.best_buddies) = 0 THEN ARRAY['ESTB', 'ENFB']::text[] ELSE t.best_buddies END
  FROM public.quizzes z WHERE t.quiz_id = z.id AND z.slug = 'pawsonality' AND z.animal_type = 'dog' AND t.code = 'ESFB';
UPDATE public.quiz_result_types t SET
  about = COALESCE(t.about, 'Always involved, never quite in charge. This dog has to be present for every household task (laundry, cooking, DIY) but prefers to supervise from a safe distance and on their own terms. Sociable and nosy, a little wary of surprises, and quite sure nothing gets done properly without them watching.'),
  famous_examples = CASE WHEN cardinality(t.famous_examples) = 0 THEN ARRAY['Cavalier King Charles Spaniel', 'Miniature Schnauzer', 'Corgi']::text[] ELSE t.famous_examples END,
  best_buddies = CASE WHEN cardinality(t.best_buddies) = 0 THEN ARRAY['ISFC', 'ESTC']::text[] ELSE t.best_buddies END
  FROM public.quizzes z WHERE t.quiz_id = z.id AND z.slug = 'pawsonality' AND z.animal_type = 'dog' AND t.code = 'ESFC';
UPDATE public.quiz_result_types t SET
  about = COALESCE(t.about, 'The eternal optimist. Every stranger is a new best friend, every walk the best walk ever, every dinner a celebration. Eager to please and quick to learn, this dog loves company, fears very little and greets the world with a full-body wiggle. Their only puzzle in life: why isn''t everyone as pleased to see them as they are to see everyone?'),
  famous_examples = CASE WHEN cardinality(t.famous_examples) = 0 THEN ARRAY['Golden Retriever', 'Labrador Retriever', 'Marley from Marley & Me']::text[] ELSE t.famous_examples END,
  best_buddies = CASE WHEN cardinality(t.best_buddies) = 0 THEN ARRAY['ESFB', 'ENTB']::text[] ELSE t.best_buddies END
  FROM public.quizzes z WHERE t.quiz_id = z.id AND z.slug = 'pawsonality' AND z.animal_type = 'dog' AND t.code = 'ESTB';
UPDATE public.quiz_result_types t SET
  about = COALESCE(t.about, 'Happy, sociable and beautifully polite. This dog loves people but always reads the room first, offering an enthusiastic tail wag from a respectful distance before moving in. Easy to train, gentle with everyone and a natural calming presence, they''re the friend who brings good vibes without ever overwhelming anyone.'),
  famous_examples = CASE WHEN cardinality(t.famous_examples) = 0 THEN ARRAY['Bernese Mountain Dog', 'Newfoundland', 'Therapy dogs everywhere']::text[] ELSE t.famous_examples END,
  best_buddies = CASE WHEN cardinality(t.best_buddies) = 0 THEN ARRAY['ISTC', 'ESFC']::text[] ELSE t.best_buddies END
  FROM public.quizzes z WHERE t.quiz_id = z.id AND z.slug = 'pawsonality' AND z.animal_type = 'dog' AND t.code = 'ESTC';
UPDATE public.quiz_result_types t SET
  about = COALESCE(t.about, 'Marches to their own beat. Calm, confident and strongly independent, this dog turns ordinary objects into toys, ordinary walks into detours and ordinary commands into polite suggestions. Clever problem-solvers who get bored by repetition, they respond best to games, variety and a little light negotiation.'),
  famous_examples = CASE WHEN cardinality(t.famous_examples) = 0 THEN ARRAY['Afghan Hound', 'Basenji', 'Dachshund']::text[] ELSE t.famous_examples END,
  best_buddies = CASE WHEN cardinality(t.best_buddies) = 0 THEN ARRAY['ENFB', 'INFC']::text[] ELSE t.best_buddies END
  FROM public.quizzes z WHERE t.quiz_id = z.id AND z.slug = 'pawsonality' AND z.animal_type = 'dog' AND t.code = 'INFB';
UPDATE public.quiz_result_types t SET
  about = COALESCE(t.about, 'Deeply independent and quietly wise. This dog keeps their own counsel, shares affection sparingly and on their terms, and has an uncanny habit of appearing the moment the biscuit tin opens. Wary of fuss and new faces, they bond deeply with a chosen few. Respect their space and you''ll earn a rare, loyal devotion.'),
  famous_examples = CASE WHEN cardinality(t.famous_examples) = 0 THEN ARRAY['Chow Chow', 'Shiba Inu', 'Saluki']::text[] ELSE t.famous_examples END,
  best_buddies = CASE WHEN cardinality(t.best_buddies) = 0 THEN ARRAY['INTC', 'INFB']::text[] ELSE t.best_buddies END
  FROM public.quizzes z WHERE t.quiz_id = z.id AND z.slug = 'pawsonality' AND z.animal_type = 'dog' AND t.code = 'INFC';
UPDATE public.quiz_result_types t SET
  about = COALESCE(t.about, 'Watches first, acts later. Calm, clever and unflappable, this dog studies the world before engaging with it and often solves problems you didn''t know they were working on. Happy in their own company, quick to learn and steady in new situations. Occasionally you''ll catch them watching you, and suspect they know exactly what you''re about to do.'),
  famous_examples = CASE WHEN cardinality(t.famous_examples) = 0 THEN ARRAY['Standard Poodle', 'Australian Shepherd', 'Greyhound']::text[] ELSE t.famous_examples END,
  best_buddies = CASE WHEN cardinality(t.best_buddies) = 0 THEN ARRAY['ENTC', 'ISTB']::text[] ELSE t.best_buddies END
  FROM public.quizzes z WHERE t.quiz_id = z.id AND z.slug = 'pawsonality' AND z.animal_type = 'dog' AND t.code = 'INTB';
UPDATE public.quiz_result_types t SET
  about = COALESCE(t.about, 'Zen in dog form. Calm, contemplative and content with a quiet life, this dog finds joy in a sunny spot, a familiar walk and a long, thoughtful gaze out of the window. Reliable and gentle, but not one for surprises, crowds or chaos. Their inner peace is something most of us can only aspire to.'),
  famous_examples = CASE WHEN cardinality(t.famous_examples) = 0 THEN ARRAY['Greyhound', 'Basset Hound', 'Shih Tzu']::text[] ELSE t.famous_examples END,
  best_buddies = CASE WHEN cardinality(t.best_buddies) = 0 THEN ARRAY['INFC', 'ISTC']::text[] ELSE t.best_buddies END
  FROM public.quizzes z WHERE t.quiz_id = z.id AND z.slug = 'pawsonality' AND z.animal_type = 'dog' AND t.code = 'INTC';
UPDATE public.quiz_result_types t SET
  about = COALESCE(t.about, 'Majestic while doing absolutely nothing. Sociable, confident and relaxed, this dog accepts attention graciously from their throne (your sofa) at a time that suits them. Unbothered by visitors, noise or fuss, they take life at their own pace and expect the world to fit around them. It usually does.'),
  famous_examples = CASE WHEN cardinality(t.famous_examples) = 0 THEN ARRAY['French Bulldog', 'English Bulldog', 'Pug']::text[] ELSE t.famous_examples END,
  best_buddies = CASE WHEN cardinality(t.best_buddies) = 0 THEN ARRAY['ISTB', 'ESFB']::text[] ELSE t.best_buddies END
  FROM public.quizzes z WHERE t.quiz_id = z.id AND z.slug = 'pawsonality' AND z.animal_type = 'dog' AND t.code = 'ISFB';
UPDATE public.quiz_result_types t SET
  about = COALESCE(t.about, 'Personal space is a myth. This dog lives for quiet time with their person and will slowly migrate across the sofa until they''re technically on your lap. Gentle, loving and a little shy with strangers, they prefer cosy routines to big adventures. If you''ve ever been followed to the bathroom, you already know.'),
  famous_examples = CASE WHEN cardinality(t.famous_examples) = 0 THEN ARRAY['Cavalier King Charles Spaniel', 'Vizsla', 'Italian Greyhound']::text[] ELSE t.famous_examples END,
  best_buddies = CASE WHEN cardinality(t.best_buddies) = 0 THEN ARRAY['ESFC', 'ISTC']::text[] ELSE t.best_buddies END
  FROM public.quizzes z WHERE t.quiz_id = z.id AND z.slug = 'pawsonality' AND z.animal_type = 'dog' AND t.code = 'ISFC';
UPDATE public.quiz_result_types t SET
  about = COALESCE(t.about, 'The strong, silent type. Calm, confident and devoted, this dog keeps a quiet eye on the family, positions themselves between you and anything unfamiliar, and takes their responsibilities very seriously. Easy to train and steady under pressure, they''re the dependable presence every household could use.'),
  famous_examples = CASE WHEN cardinality(t.famous_examples) = 0 THEN ARRAY['Rottweiler', 'Boxer', 'Akita']::text[] ELSE t.famous_examples END,
  best_buddies = CASE WHEN cardinality(t.best_buddies) = 0 THEN ARRAY['INTB', 'ISFB']::text[] ELSE t.best_buddies END
  FROM public.quizzes z WHERE t.quiz_id = z.id AND z.slug = 'pawsonality' AND z.animal_type = 'dog' AND t.code = 'ISTB';
UPDATE public.quiz_result_types t SET
  about = COALESCE(t.about, 'Quiet, kind and an excellent judge of character. This dog prefers peaceful moments, approaches anything new slowly with a cautious wag, and seems to know what you need before you do. Happiest with familiar people and gentle routines, they''re the friend who simply shows up when it matters.'),
  famous_examples = CASE WHEN cardinality(t.famous_examples) = 0 THEN ARRAY['Greyhound', 'Cavalier King Charles Spaniel', 'Labrador (the older, wiser kind)']::text[] ELSE t.famous_examples END,
  best_buddies = CASE WHEN cardinality(t.best_buddies) = 0 THEN ARRAY['ESTC', 'ISFC']::text[] ELSE t.best_buddies END
  FROM public.quizzes z WHERE t.quiz_id = z.id AND z.slug = 'pawsonality' AND z.animal_type = 'dog' AND t.code = 'ISTC';
-- cats
UPDATE public.quiz_result_types t SET
  about = COALESCE(t.about, 'Doors are merely suggestions. Restless, fearless and answerable to no one, this cat treats every closed window as a challenge and every cupboard as unexplored territory. They vanish without a trace and reappear somewhere impossible, looking entirely innocent. Keep them busy with climbing, hunting games and secure outdoor space, and lock the cat flap at your peril.'),
  famous_examples = CASE WHEN cardinality(t.famous_examples) = 0 THEN ARRAY['Bengal', 'Abyssinian', 'Savannah']::text[] ELSE t.famous_examples END,
  best_buddies = CASE WHEN cardinality(t.best_buddies) = 0 THEN ARRAY['ESFB', 'ENTB']::text[] ELSE t.best_buddies END
  FROM public.quizzes z WHERE t.quiz_id = z.id AND z.slug = 'pawsonality' AND z.animal_type = 'cat' AND t.code = 'ENFB';
UPDATE public.quiz_result_types t SET
  about = COALESCE(t.about, 'Seen at speed, never caught on camera. Quick, agile and fiercely independent, this cat keeps well clear of fuss, guests and anything resembling a carrier. You know they live with you because the food disappears. Give them high perches and hiding spots, let them come to you, and you may earn the rarest thing of all: a voluntary appearance.'),
  famous_examples = CASE WHEN cardinality(t.famous_examples) = 0 THEN ARRAY['Russian Blue', 'Oriental Shorthair', 'Egyptian Mau']::text[] ELSE t.famous_examples END,
  best_buddies = CASE WHEN cardinality(t.best_buddies) = 0 THEN ARRAY['INFC', 'ENTC']::text[] ELSE t.best_buddies END
  FROM public.quizzes z WHERE t.quiz_id = z.id AND z.slug = 'pawsonality' AND z.animal_type = 'cat' AND t.code = 'ENFC';
UPDATE public.quiz_result_types t SET
  about = COALESCE(t.about, 'A cat with a job. Active, self-sufficient and fearless outdoors, they walk the same route at the same time every evening, checking the fences, the flowerbeds and the neighbour''s shed. Reliable as clockwork, they''re home for dinner on the dot and expect it to be ready. Routine is everything; adventure is the bonus.'),
  famous_examples = CASE WHEN cardinality(t.famous_examples) = 0 THEN ARRAY['British Shorthair', 'Maine Coon', 'Norwegian Forest Cat']::text[] ELSE t.famous_examples END,
  best_buddies = CASE WHEN cardinality(t.best_buddies) = 0 THEN ARRAY['ENTC', 'ESTB']::text[] ELSE t.best_buddies END
  FROM public.quizzes z WHERE t.quiz_id = z.id AND z.slug = 'pawsonality' AND z.animal_type = 'cat' AND t.code = 'ENTB';
UPDATE public.quiz_result_types t SET
  about = COALESCE(t.about, 'Nothing happens without their knowledge. Alert, independent and reliable, this cat runs surveillance from the highest point in the room, usually the top of the wardrobe. Careful with strangers and suspicious of change, they love routine and a good vantage point. If something moves in the night, they saw it first.'),
  famous_examples = CASE WHEN cardinality(t.famous_examples) = 0 THEN ARRAY['Siamese', 'Burmese', 'Korat']::text[] ELSE t.famous_examples END,
  best_buddies = CASE WHEN cardinality(t.best_buddies) = 0 THEN ARRAY['ENTB', 'INTC']::text[] ELSE t.best_buddies END
  FROM public.quizzes z WHERE t.quiz_id = z.id AND z.slug = 'pawsonality' AND z.animal_type = 'cat' AND t.code = 'ENTC';
UPDATE public.quiz_result_types t SET
  about = COALESCE(t.about, 'All energy, no brakes. This cat loves an audience, ignores the rules and fears absolutely nothing, which is how the 3am laps end on your face. Playful, bold and endlessly entertaining, they need daily hunting games, things to climb and an owner who doesn''t mind the occasional broken ornament.'),
  famous_examples = CASE WHEN cardinality(t.famous_examples) = 0 THEN ARRAY['Bengal', 'Devon Rex', 'Abyssinian']::text[] ELSE t.famous_examples END,
  best_buddies = CASE WHEN cardinality(t.best_buddies) = 0 THEN ARRAY['ENFB', 'ESTB']::text[] ELSE t.best_buddies END
  FROM public.quizzes z WHERE t.quiz_id = z.id AND z.slug = 'pawsonality' AND z.animal_type = 'cat' AND t.code = 'ESFB';
UPDATE public.quiz_result_types t SET
  about = COALESCE(t.about, 'Loves company, has notes on everything. Lively and sociable, this cat will talk you through their day and complain loudly when anything changes: a moved cushion, a new brand of food, a late breakfast. Affectionate on their own terms and gloriously opinionated, they''re happiest with a predictable routine and an owner who enjoys a conversation.'),
  famous_examples = CASE WHEN cardinality(t.famous_examples) = 0 THEN ARRAY['Siamese', 'Oriental Shorthair', 'Tonkinese']::text[] ELSE t.famous_examples END,
  best_buddies = CASE WHEN cardinality(t.best_buddies) = 0 THEN ARRAY['ESTC', 'ISFC']::text[] ELSE t.best_buddies END
  FROM public.quizzes z WHERE t.quiz_id = z.id AND z.slug = 'pawsonality' AND z.animal_type = 'cat' AND t.code = 'ESFC';
UPDATE public.quiz_result_types t SET
  about = COALESCE(t.about, 'Thinks every visitor came to see them, and is usually right. Lively, sociable and quick to come when called, this cat is first to the door, first into the new cardboard box and first onto the guest''s lap. Confident, friendly and easy to live with, they''re the closest thing to a dog the cat world allows.'),
  famous_examples = CASE WHEN cardinality(t.famous_examples) = 0 THEN ARRAY['Ragdoll', 'Maine Coon', 'Sphynx']::text[] ELSE t.famous_examples END,
  best_buddies = CASE WHEN cardinality(t.best_buddies) = 0 THEN ARRAY['ESFB', 'ISTB']::text[] ELSE t.best_buddies END
  FROM public.quizzes z WHERE t.quiz_id = z.id AND z.slug = 'pawsonality' AND z.animal_type = 'cat' AND t.code = 'ESTB';
UPDATE public.quiz_result_types t SET
  about = COALESCE(t.about, 'Your gentle shadow. This cat is busy, affectionate and follows you from room to room, one step behind, supervising everything you do. They love routine and their people, but anything new (visitors, furniture, holidays) gets a very wary look. Keep life predictable and they''ll be the most loyal companion you''ve ever had.'),
  famous_examples = CASE WHEN cardinality(t.famous_examples) = 0 THEN ARRAY['Burmese', 'Birman', 'Scottish Fold']::text[] ELSE t.famous_examples END,
  best_buddies = CASE WHEN cardinality(t.best_buddies) = 0 THEN ARRAY['ESFC', 'ISTC']::text[] ELSE t.best_buddies END
  FROM public.quizzes z WHERE t.quiz_id = z.id AND z.slug = 'pawsonality' AND z.animal_type = 'cat' AND t.code = 'ESTC';
UPDATE public.quiz_result_types t SET
  about = COALESCE(t.about, 'Untouchable, unbothered, unimpressed. Serene, self-sufficient and fearless, this cat makes their own rules and has a gift for sitting on exactly the thing you need right now, usually the laptop. They don''t ignore you; they simply choose not to notice. Earn their favour with good food, a sunny spot and absolutely no demands.'),
  famous_examples = CASE WHEN cardinality(t.famous_examples) = 0 THEN ARRAY['Persian', 'Turkish Angora', 'Duchess from The Aristocats']::text[] ELSE t.famous_examples END,
  best_buddies = CASE WHEN cardinality(t.best_buddies) = 0 THEN ARRAY['ISFB', 'INTB']::text[] ELSE t.best_buddies END
  FROM public.quizzes z WHERE t.quiz_id = z.id AND z.slug = 'pawsonality' AND z.animal_type = 'cat' AND t.code = 'INFB';
UPDATE public.quiz_result_types t SET
  about = COALESCE(t.about, 'Arrives when they like, leaves when they like, explains nothing. Quiet, independent and wary of fuss, this cat keeps their distance and their secrets. They''ll appear silently beside you, accept a single stroke, then vanish. Patience is everything: give them space and calm, and they''ll choose you in their own time.'),
  famous_examples = CASE WHEN cardinality(t.famous_examples) = 0 THEN ARRAY['Russian Blue', 'Chartreux', 'Norwegian Forest Cat']::text[] ELSE t.famous_examples END,
  best_buddies = CASE WHEN cardinality(t.best_buddies) = 0 THEN ARRAY['ENFC', 'INTC']::text[] ELSE t.best_buddies END
  FROM public.quizzes z WHERE t.quiz_id = z.id AND z.slug = 'pawsonality' AND z.animal_type = 'cat' AND t.code = 'INFC';
UPDATE public.quiz_result_types t SET
  about = COALESCE(t.about, 'Has seen it all, impressed by none of it. Unhurried and self-contained, this cat knows the household routine better than you do and is fazed by nothing: not visitors, not the hoover, not the new puppy. Their calm, unblinking stare ends most arguments. Wise, steady and quietly affectionate when it suits them.'),
  famous_examples = CASE WHEN cardinality(t.famous_examples) = 0 THEN ARRAY['British Shorthair', 'Maine Coon', 'Chartreux']::text[] ELSE t.famous_examples END,
  best_buddies = CASE WHEN cardinality(t.best_buddies) = 0 THEN ARRAY['INFB', 'ISTB']::text[] ELSE t.best_buddies END
  FROM public.quizzes z WHERE t.quiz_id = z.id AND z.slug = 'pawsonality' AND z.animal_type = 'cat' AND t.code = 'INTB';
UPDATE public.quiz_result_types t SET
  about = COALESCE(t.about, 'Watches the world from a safe and comfy distance. Quiet, independent and fond of routine, this cat spends hours at the window, tail twitching at pigeons, thinking deep thoughts. They prefer observing to joining in and like their days predictable. A good window seat and a bird feeder outside will keep them content for years.'),
  famous_examples = CASE WHEN cardinality(t.famous_examples) = 0 THEN ARRAY['Ragdoll', 'Scottish Fold', 'Exotic Shorthair']::text[] ELSE t.famous_examples END,
  best_buddies = CASE WHEN cardinality(t.best_buddies) = 0 THEN ARRAY['INFC', 'ENTC']::text[] ELSE t.best_buddies END
  FROM public.quizzes z WHERE t.quiz_id = z.id AND z.slug = 'pawsonality' AND z.animal_type = 'cat' AND t.code = 'INTC';
UPDATE public.quiz_result_types t SET
  about = COALESCE(t.about, 'Enjoys company, on their throne, on their terms. Relaxed, sociable and unbothered by almost anything, this cat takes your seat the moment you stand up and looks genuinely surprised when you want it back. Easygoing with visitors and noise, they rule the household with a gentle, lazy confidence.'),
  famous_examples = CASE WHEN cardinality(t.famous_examples) = 0 THEN ARRAY['Persian', 'British Shorthair', 'Garfield']::text[] ELSE t.famous_examples END,
  best_buddies = CASE WHEN cardinality(t.best_buddies) = 0 THEN ARRAY['INFB', 'ISTB']::text[] ELSE t.best_buddies END
  FROM public.quizzes z WHERE t.quiz_id = z.id AND z.slug = 'pawsonality' AND z.animal_type = 'cat' AND t.code = 'ISFB';
UPDATE public.quiz_result_types t SET
  about = COALESCE(t.about, 'Loves exactly one person, under exactly one blanket. Calm and deeply affectionate with their chosen human, this cat is shy with everyone else and does cuddles strictly their way: under the duvet, at bedtime, purring. Quiet routines and a warm bed make them happiest. If you''re the chosen one, consider yourself honoured.'),
  famous_examples = CASE WHEN cardinality(t.famous_examples) = 0 THEN ARRAY['Ragdoll', 'Birman', 'Himalayan']::text[] ELSE t.famous_examples END,
  best_buddies = CASE WHEN cardinality(t.best_buddies) = 0 THEN ARRAY['ISTC', 'ESFC']::text[] ELSE t.best_buddies END
  FROM public.quizzes z WHERE t.quiz_id = z.id AND z.slug = 'pawsonality' AND z.animal_type = 'cat' AND t.code = 'ISFC';
UPDATE public.quiz_result_types t SET
  about = COALESCE(t.about, 'Picks a lap, and the lap is honoured. Calm, affectionate and confident, this cat knows the routine, settles anywhere and will happily claim any lap going, guests'' included, without asking. Easy to live with and unfazed by visitors, they''re a warm, purring weight that makes leaving the sofa impossible.'),
  famous_examples = CASE WHEN cardinality(t.famous_examples) = 0 THEN ARRAY['Ragdoll', 'Maine Coon', 'British Shorthair']::text[] ELSE t.famous_examples END,
  best_buddies = CASE WHEN cardinality(t.best_buddies) = 0 THEN ARRAY['ESTB', 'ISFB']::text[] ELSE t.best_buddies END
  FROM public.quizzes z WHERE t.quiz_id = z.id AND z.slug = 'pawsonality' AND z.animal_type = 'cat' AND t.code = 'ISTB';
UPDATE public.quiz_result_types t SET
  about = COALESCE(t.about, 'Says it all with a look. Quiet, loving and close to their people, this cat likes things the same and shows affection with a slow blink from the next cushion. Gentle and a little shy, they''re happiest with familiar faces and calm surroundings. Blink back slowly: in cat, it means ''I love you too''.'),
  famous_examples = CASE WHEN cardinality(t.famous_examples) = 0 THEN ARRAY['Birman', 'Scottish Fold', 'Burmese']::text[] ELSE t.famous_examples END,
  best_buddies = CASE WHEN cardinality(t.best_buddies) = 0 THEN ARRAY['ISFC', 'ESTC']::text[] ELSE t.best_buddies END
  FROM public.quizzes z WHERE t.quiz_id = z.id AND z.slug = 'pawsonality' AND z.animal_type = 'cat' AND t.code = 'ISTC';

COMMIT;
