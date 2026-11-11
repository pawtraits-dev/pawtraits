-- Phone cases phase 2: case art per design, per layout group (see lib/phone-cases/case-art.ts).
-- image_catalog.case_art = { "<group>": { public_id, width, height, layout, status, match, created_at, approved_at } }
-- A design is offered as a phone case for a model once its model's layout group is 'approved'.
ALTER TABLE public.image_catalog ADD COLUMN IF NOT EXISTS case_art jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE INDEX IF NOT EXISTS idx_image_catalog_has_case_art ON public.image_catalog ((case_art <> '{}'::jsonb)) WHERE case_art <> '{}'::jsonb;
