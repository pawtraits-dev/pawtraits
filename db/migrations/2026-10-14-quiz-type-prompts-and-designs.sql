-- =============================================================================
-- Pawsonality result types: Midjourney picture prompts + several designs per type
--   image_prompt      the picture's composition (what the animal is doing and wearing, the setting);
--                     the art style is added separately. Admin only (not published to customers).
--   design_image_ids  every catalogue design for the type (e.g. one per style: cartoon, oil painting).
--                     The FIRST is the main design and is mirrored into design_image_id, which results
--                     and breed pictures use.
-- Safe to re-run.
-- =============================================================================
BEGIN;

ALTER TABLE public.quiz_result_types ADD COLUMN IF NOT EXISTS image_prompt text;
ALTER TABLE public.quiz_result_types ADD COLUMN IF NOT EXISTS design_image_ids uuid[] NOT NULL DEFAULT '{}';

-- Existing single designs become the first (main) design
UPDATE public.quiz_result_types
   SET design_image_ids = ARRAY[design_image_id]
 WHERE design_image_id IS NOT NULL AND cardinality(design_image_ids) = 0;

-- Starting prompts (only where none has been written yet)
-- dogs
UPDATE public.quiz_result_types t SET image_prompt = 'A dog wearing a jester''s hat with jingling bells and a mismatched patchwork waistcoat, caught mid-leap off an upturned armchair with all four paws in the air, a juggling ball in its mouth and two more frozen in the air beside it, a toppled lamp and a trail of scattered cushions behind, ears flying, wild delighted eyes'
  FROM public.quizzes z WHERE t.quiz_id = z.id AND z.slug = 'pawsonality' AND z.animal_type = 'dog' AND t.code = 'ENFB' AND t.image_prompt IS NULL;
UPDATE public.quiz_result_types t SET image_prompt = 'A dog in a bright yellow raincoat and matching sou''wester hat, standing at the very edge of a large puddle with one front paw lifted and hovering just above the water, body leaning forward eagerly but back paws firmly planted, tail wagging hard, a rubber duck floating in the puddle, light drizzle falling'
  FROM public.quizzes z WHERE t.quiz_id = z.id AND z.slug = 'pawsonality' AND z.animal_type = 'dog' AND t.code = 'ENFC' AND t.image_prompt IS NULL;
UPDATE public.quiz_result_types t SET image_prompt = 'A dog in a red superhero cape and a small black eye mask, bursting through a garden hedge mid-sprint with leaves flying, a stolen sock clamped proudly in its mouth, chest out and ears streaming back, a toppled flower pot behind it, a triumphant, determined expression'
  FROM public.quizzes z WHERE t.quiz_id = z.id AND z.slug = 'pawsonality' AND z.animal_type = 'dog' AND t.code = 'ENTB' AND t.image_prompt IS NULL;
UPDATE public.quiz_result_types t SET image_prompt = 'A dog wearing round tortoiseshell spectacles and a tweed jacket with elbow patches, sitting upright very close to the viewer with its head tilted, studying them intently, a magnifying glass held in one paw, an open notebook full of scribbles and a stack of books beside it, eyebrows raised in intense curiosity'
  FROM public.quizzes z WHERE t.quiz_id = z.id AND z.slug = 'pawsonality' AND z.animal_type = 'dog' AND t.code = 'ENTC' AND t.image_prompt IS NULL;
UPDATE public.quiz_result_types t SET image_prompt = 'A dog wearing a sparkly party hat and a sequinned bow tie, mid-bounce in the middle of a living-room party with a party blower in its mouth, streamers and confetti raining down, balloons tied to its collar, a half-eaten slice of birthday cake on the floor, tongue out and ecstatic'
  FROM public.quizzes z WHERE t.quiz_id = z.id AND z.slug = 'pawsonality' AND z.animal_type = 'dog' AND t.code = 'ESFB' AND t.image_prompt IS NULL;
UPDATE public.quiz_result_types t SET image_prompt = 'A dog wearing a yellow hard hat and a high-visibility vest, standing on a footstool one careful step back from a stepladder (only the decorator''s legs visible), a clipboard tucked under one paw and a pencil behind its ear, peering closely at an open paint tin and roller, a toolbox at its feet, a serious supervising expression'
  FROM public.quizzes z WHERE t.quiz_id = z.id AND z.slug = 'pawsonality' AND z.animal_type = 'dog' AND t.code = 'ESFC' AND t.image_prompt IS NULL;
UPDATE public.quiz_result_types t SET image_prompt = 'A dog wearing a large red rosette and a cheerful spotted neckerchief, standing in an open front doorway in a full-body wiggle with its tail a blur, a tennis ball dropped at the feet of an arriving visitor (only their shoes visible), a bunch of daisies tucked into its collar, mouth open in a huge grin'
  FROM public.quizzes z WHERE t.quiz_id = z.id AND z.slug = 'pawsonality' AND z.animal_type = 'dog' AND t.code = 'ESTB' AND t.image_prompt IS NULL;
UPDATE public.quiz_result_types t SET image_prompt = 'A large dog wearing a knitted cardigan and a small bow tie, sitting politely on the lawn at a garden party a respectful distance from a group of guests (only their legs visible), tail mid-wag sweeping the grass, head slightly lowered with soft hopeful eyes, a teacup and saucer balanced carefully in one paw'
  FROM public.quizzes z WHERE t.quiz_id = z.id AND z.slug = 'pawsonality' AND z.animal_type = 'dog' AND t.code = 'ESTC' AND t.image_prompt IS NULL;
UPDATE public.quiz_result_types t SET image_prompt = 'A dog wearing a paint-splattered artist''s smock and a floppy beret, standing beside an easel with a paintbrush held in its mouth, having painted on the wall instead of the canvas, paw prints in every colour across the floor, a tipped-over paint pot, a cardboard box turned into a sculpture beside it, a proud, mischievous look'
  FROM public.quizzes z WHERE t.quiz_id = z.id AND z.slug = 'pawsonality' AND z.animal_type = 'dog' AND t.code = 'INFB' AND t.image_prompt IS NULL;
UPDATE public.quiz_result_types t SET image_prompt = 'A dog wearing a deep purple hooded cloak embroidered with stars and moons, seated behind a small round table with a glowing crystal ball, one paw resting on a fanned deck of cards, half hidden beside a heavy velvet curtain, candles flickering on the table, eyes half-closed with a knowing look'
  FROM public.quizzes z WHERE t.quiz_id = z.id AND z.slug = 'pawsonality' AND z.animal_type = 'dog' AND t.code = 'INFC' AND t.image_prompt IS NULL;
UPDATE public.quiz_result_types t SET image_prompt = 'A dog wearing a deerstalker hat and a short checked cape, lying on a rug with its chin raised, studying a half-finished chess game with one chess piece held delicately in its paw, a magnifying glass and an open pocket watch beside the board, eyes narrowed in calm calculation'
  FROM public.quizzes z WHERE t.quiz_id = z.id AND z.slug = 'pawsonality' AND z.animal_type = 'dog' AND t.code = 'INTB' AND t.image_prompt IS NULL;
UPDATE public.quiz_result_types t SET image_prompt = 'A dog wearing a loose linen robe and a string of wooden beads, sitting cross-legged on a meditation cushion on a mossy rock beside a still pond, eyes gently closed, a single lotus flower floating nearby, a maple leaf drifting down, a small steaming cup of tea at its side'
  FROM public.quizzes z WHERE t.quiz_id = z.id AND z.slug = 'pawsonality' AND z.animal_type = 'dog' AND t.code = 'INTC' AND t.image_prompt IS NULL;
UPDATE public.quiz_result_types t SET image_prompt = 'A dog wearing a velvet smoking jacket and a small golden crown, sprawled regally across a plush sofa among silk cushions, one paw draped over the armrest holding the TV remote, a bowl of popcorn balanced on its belly, a pair of slippers on the floor below, an expression of serene entitlement'
  FROM public.quizzes z WHERE t.quiz_id = z.id AND z.slug = 'pawsonality' AND z.animal_type = 'dog' AND t.code = 'ISFB' AND t.image_prompt IS NULL;
UPDATE public.quiz_result_types t SET image_prompt = 'A dog wearing cosy knitted pyjamas and fluffy bed socks, squeezed onto the same armchair as its person (only their arm and a knitted blanket visible), chin resting on their lap and body pressed as close as possible, a mug of cocoa on the side table, eyes heavy with contentment'
  FROM public.quizzes z WHERE t.quiz_id = z.id AND z.slug = 'pawsonality' AND z.animal_type = 'dog' AND t.code = 'ISFC' AND t.image_prompt IS NULL;
UPDATE public.quiz_result_types t SET image_prompt = 'A dog wearing a ceremonial guard''s red tunic with brass buttons and a small bearskin hat, standing to attention on the front step of a cosy cottage, chest out, a steady watchful gaze, a lantern glowing beside the door, the family''s wellington boots lined up behind it'
  FROM public.quizzes z WHERE t.quiz_id = z.id AND z.slug = 'pawsonality' AND z.animal_type = 'dog' AND t.code = 'ISTB' AND t.image_prompt IS NULL;
UPDATE public.quiz_result_types t SET image_prompt = 'A dog wearing a soft knitted scarf and a woolly hat, walking slowly along a garden path carrying a small basket of wildflowers in its mouth, head slightly bowed, tail giving a small cautious wag, a robin perched on a nearby fence post, early morning'
  FROM public.quizzes z WHERE t.quiz_id = z.id AND z.slug = 'pawsonality' AND z.animal_type = 'dog' AND t.code = 'ISTC' AND t.image_prompt IS NULL;
-- cats
UPDATE public.quiz_result_types t SET image_prompt = 'A cat wearing a black-and-white striped jumper and a burglar''s eye mask, squeezing out through a half-open window down a knotted bedsheet rope, a key dangling from its mouth, an empty cat carrier with its door swung open on the floor below, a smug expression'
  FROM public.quizzes z WHERE t.quiz_id = z.id AND z.slug = 'pawsonality' AND z.animal_type = 'cat' AND t.code = 'ENFB' AND t.image_prompt IS NULL;
UPDATE public.quiz_result_types t SET image_prompt = 'A cat wearing a long dark cloak and a white half-face mask, caught mid-leap between two rooftops at night with the cloak billowing, mostly in shadow with only its bright eyes and tail clearly visible, a full moon behind, a startled pigeon taking off'
  FROM public.quizzes z WHERE t.quiz_id = z.id AND z.slug = 'pawsonality' AND z.animal_type = 'cat' AND t.code = 'ENFC' AND t.image_prompt IS NULL;
UPDATE public.quiz_result_types t SET image_prompt = 'A cat wearing a park ranger''s hat and a khaki uniform with a little badge, striding along the top of a garden fence with its tail held high, binoculars around its neck and a pocket watch in one paw, flowerbeds and a shed below, a purposeful expression'
  FROM public.quizzes z WHERE t.quiz_id = z.id AND z.slug = 'pawsonality' AND z.animal_type = 'cat' AND t.code = 'ENTB' AND t.image_prompt IS NULL;
UPDATE public.quiz_result_types t SET image_prompt = 'A cat wearing a night watchman''s peaked cap and a long navy coat with a ring of keys on its belt, perched on top of a tall wardrobe holding an old brass lantern, eyes wide and alert, scanning the dark bedroom below, moonlight slanting through the curtains'
  FROM public.quizzes z WHERE t.quiz_id = z.id AND z.slug = 'pawsonality' AND z.animal_type = 'cat' AND t.code = 'ENTC' AND t.image_prompt IS NULL;
UPDATE public.quiz_result_types t SET image_prompt = 'A cat wearing a tiny racing helmet and goggles, skidding around a hallway corner at full speed with the rug bunched up behind it, a knocked-over plant pot and sheets of paper flying, a toy mouse launched into the air, ears back and eyes wild with glee'
  FROM public.quizzes z WHERE t.quiz_id = z.id AND z.slug = 'pawsonality' AND z.animal_type = 'cat' AND t.code = 'ESFB' AND t.image_prompt IS NULL;
UPDATE public.quiz_result_types t SET image_prompt = 'A cat wearing a feather boa, a pearl necklace and oversized sunglasses pushed up on its head, sitting on a velvet chaise longue with its mouth open mid-complaint and one paw raised theatrically, an old telephone receiver held to its ear, glaring at a cushion that has been moved'
  FROM public.quizzes z WHERE t.quiz_id = z.id AND z.slug = 'pawsonality' AND z.animal_type = 'cat' AND t.code = 'ESFC' AND t.image_prompt IS NULL;
UPDATE public.quiz_result_types t SET image_prompt = 'A cat wearing a hotel concierge''s red jacket with gold buttons and a pillbox hat, standing on its hind legs at an open front door, one paw gesturing grandly towards the sofa, the other holding a small tray with a saucer of milk, an empty cardboard box waiting behind it, a beaming welcome'
  FROM public.quizzes z WHERE t.quiz_id = z.id AND z.slug = 'pawsonality' AND z.animal_type = 'cat' AND t.code = 'ESTB' AND t.image_prompt IS NULL;
UPDATE public.quiz_result_types t SET image_prompt = 'A cat wearing a small striped apron, following one step behind its person in a kitchen (only their slippered feet and apron hem visible), carrying a wooden spoon in its mouth, tail curled into a question mark, looking up adoringly, a mixing bowl on the floor'
  FROM public.quizzes z WHERE t.quiz_id = z.id AND z.slug = 'pawsonality' AND z.animal_type = 'cat' AND t.code = 'ESTC' AND t.image_prompt IS NULL;
UPDATE public.quiz_result_types t SET image_prompt = 'A cat wearing a powdered Georgian wig, a lace cravat and a brocade waistcoat, lounging across an open laptop keyboard in a grand drawing room, chin raised and eyes half-closed in total disdain, one paw resting on a porcelain teacup, a silver bell and an untouched dish of fine food beside it'
  FROM public.quizzes z WHERE t.quiz_id = z.id AND z.slug = 'pawsonality' AND z.animal_type = 'cat' AND t.code = 'INFB' AND t.image_prompt IS NULL;
UPDATE public.quiz_result_types t SET image_prompt = 'A cat wearing a trench coat with the collar turned up and a wide-brimmed fedora, half visible in a doorway with most of its body still in the dark hallway, one eye catching the light, a single trail of paw prints leading away across the floor'
  FROM public.quizzes z WHERE t.quiz_id = z.id AND z.slug = 'pawsonality' AND z.animal_type = 'cat' AND t.code = 'INFC' AND t.image_prompt IS NULL;
UPDATE public.quiz_result_types t SET image_prompt = 'A cat wearing half-moon reading glasses and a velvet robe, seated upright in a leather wingback chair with its paws neatly folded, giving a calm unblinking stare, an hourglass and a pile of old books beside it, a toy mouse lying defeated at its feet'
  FROM public.quizzes z WHERE t.quiz_id = z.id AND z.slug = 'pawsonality' AND z.animal_type = 'cat' AND t.code = 'INTB' AND t.image_prompt IS NULL;
UPDATE public.quiz_result_types t SET image_prompt = 'A cat wearing a turtleneck jumper and a beret, sitting on a cushioned windowsill gazing out at pigeons on a neighbouring rooftop, the tip of its tail mid-twitch, a closed book of poetry beside it, a cup of tea going cold, rain on the glass'
  FROM public.quizzes z WHERE t.quiz_id = z.id AND z.slug = 'pawsonality' AND z.animal_type = 'cat' AND t.code = 'INTC' AND t.image_prompt IS NULL;
UPDATE public.quiz_result_types t SET image_prompt = 'A cat wearing an ermine-trimmed royal cape and a jewelled crown, lounging in the warm dent in the middle seat of a sofa, a sceptre propped against the armrest, a person''s book and cushion pushed aside onto the floor, gazing down imperiously'
  FROM public.quizzes z WHERE t.quiz_id = z.id AND z.slug = 'pawsonality' AND z.animal_type = 'cat' AND t.code = 'ISFB' AND t.image_prompt IS NULL;
UPDATE public.quiz_result_types t SET image_prompt = 'A cat wearing a knitted nightcap and tiny striped pyjamas, peeking out from under a puffy duvet in a cosy bed, nestled against the shoulder of its sleeping chosen human (only their hair and arm visible), just its face and front paws showing, eyes soft and content'
  FROM public.quizzes z WHERE t.quiz_id = z.id AND z.slug = 'pawsonality' AND z.animal_type = 'cat' AND t.code = 'ISFC' AND t.image_prompt IS NULL;
UPDATE public.quiz_result_types t SET image_prompt = 'A cat wearing a small velvet crown and a royal sash, curled up on the lap of a seated visitor (only their knees and hands visible) who is holding a teacup awkwardly aloft so as not to disturb it, eyes closed in complete entitlement'
  FROM public.quizzes z WHERE t.quiz_id = z.id AND z.slug = 'pawsonality' AND z.animal_type = 'cat' AND t.code = 'ISTB' AND t.image_prompt IS NULL;
UPDATE public.quiz_result_types t SET image_prompt = 'A cat wearing a soft knitted shawl, curled on a cushion right beside its owner on a sofa (only their hand visible, resting nearby), mid slow blink with its eyes half closed, a lamp and a ball of wool on the side table, a calm, affectionate expression'
  FROM public.quizzes z WHERE t.quiz_id = z.id AND z.slug = 'pawsonality' AND z.animal_type = 'cat' AND t.code = 'ISTC' AND t.image_prompt IS NULL;

COMMIT;
