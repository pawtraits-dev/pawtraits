-- Mugs paint the customer's pet with the same prompt as the main customisation (lib/customise/painting.ts).
-- That prompt keeps the design's composition and style using the design's Claude composition analysis
-- (variation_prompt_template). Mug designs get one too: made on first use and cached here.
ALTER TABLE public.mug_catalog
  ADD COLUMN IF NOT EXISTS variation_prompt_template text,
  ADD COLUMN IF NOT EXISTS template_analysed_at timestamptz;
