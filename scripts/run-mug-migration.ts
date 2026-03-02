/**
 * Mug Feature Database Migration
 * Run: tsx scripts/run-mug-migration.ts
 *
 * Creates:
 *  - mug_colours table (with seed data)
 *  - mug_catalog table
 *  - mug_generations table
 *  - order_items.mug_generation_id column (additive)
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const migration = `
-- ============================================================
-- Pawtraits Mug Feature Migration
-- ============================================================

-- 1. mug_colours
CREATE TABLE IF NOT EXISTS public.mug_colours (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  slug        TEXT NOT NULL UNIQUE,
  hex         TEXT NOT NULL,
  text_hex    TEXT NOT NULL,
  overlay_hex TEXT NOT NULL,
  sort_order  INTEGER DEFAULT 0,
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- RLS: public SELECT, service role writes only
ALTER TABLE public.mug_colours ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='mug_colours' AND policyname='mug_colours_public_select'
  ) THEN
    CREATE POLICY mug_colours_public_select ON public.mug_colours
      FOR SELECT USING (true);
  END IF;
END $$;

-- Seed colours (idempotent)
INSERT INTO public.mug_colours (name, slug, hex, text_hex, overlay_hex, sort_order) VALUES
  ('Yellow', 'yellow', 'FDD26E', '2D2926', 'FDD26E', 1),
  ('Navy',   'navy',   '012168', 'FDD26E', '012168', 2),
  ('Pink',   'pink',   'E4A9BB', '2D2926', 'E4A9BB', 3),
  ('Green',  'green',  'A4D65B', '012168', 'A4D65B', 4),
  ('Red',    'red',    'D22730', 'FFFFFF', 'D22730', 5),
  ('Black',  'black',  '2D2926', 'FDD26E', '2D2926', 6)
ON CONFLICT (slug) DO NOTHING;

-- 2. mug_catalog
CREATE TABLE IF NOT EXISTS public.mug_catalog (
  id                      UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  type                    TEXT NOT NULL CHECK (type IN ('zodiac', 'breed')),
  slug                    TEXT NOT NULL UNIQUE,
  name                    TEXT NOT NULL,
  sub_heading             TEXT NOT NULL,
  description             TEXT NOT NULL,
  description_short       TEXT,
  catalog_image_url       TEXT NOT NULL,
  catalog_image_public_id TEXT NOT NULL,
  animal_type             TEXT CHECK (animal_type IN ('dog', 'cat', 'both')),
  is_active               BOOLEAN DEFAULT true,
  sort_order              INTEGER DEFAULT 0,
  created_at              TIMESTAMPTZ DEFAULT now(),
  updated_at              TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.mug_catalog ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='mug_catalog' AND policyname='mug_catalog_public_select'
  ) THEN
    CREATE POLICY mug_catalog_public_select ON public.mug_catalog
      FOR SELECT USING (true);
  END IF;
END $$;

-- 3. mug_generations
CREATE TABLE IF NOT EXISTS public.mug_generations (
  id                           UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  customer_id                  UUID REFERENCES public.user_profiles(id),
  session_id                   TEXT,
  mug_catalog_id               UUID REFERENCES public.mug_catalog(id),
  mug_colour_id                UUID REFERENCES public.mug_colours(id),
  pet_name                     TEXT NOT NULL,
  pet_photo_url                TEXT NOT NULL,
  pet_photo_public_id          TEXT NOT NULL,
  personalised_image_url       TEXT,
  personalised_image_public_id TEXT,
  composite_preview_url        TEXT,
  composite_print_url          TEXT,
  status                       TEXT DEFAULT 'pending'
                               CHECK (status IN ('pending', 'generating', 'complete', 'failed', 'purchased')),
  gemini_prompt                TEXT,
  error_message                TEXT,
  generation_time_ms           INTEGER,
  created_at                   TIMESTAMPTZ DEFAULT now(),
  updated_at                   TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.mug_generations ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='mug_generations' AND policyname='mug_generations_own_select'
  ) THEN
    CREATE POLICY mug_generations_own_select ON public.mug_generations
      FOR SELECT USING (
        customer_id = auth.uid()
        OR session_id IS NOT NULL
      );
  END IF;
END $$;

-- 4. order_items: add mug_generation_id column (additive)
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS mug_generation_id UUID REFERENCES public.mug_generations(id);
`;

async function runMigration() {
  console.log('🚀 Running mug feature migration...');

  const { error } = await supabase.rpc('exec_sql', { sql: migration }).maybeSingle();

  if (error) {
    // Try direct approach if exec_sql RPC doesn't exist
    console.log('ℹ️  exec_sql RPC not available — printing SQL for manual execution');
    console.log('\n' + '='.repeat(60));
    console.log('COPY THE SQL BELOW AND RUN IN SUPABASE SQL EDITOR:');
    console.log('='.repeat(60));
    console.log(migration);
    console.log('='.repeat(60));
    console.log('\nAlternatively, paste this into the Supabase SQL editor at:');
    console.log(`${supabaseUrl.replace('https://', 'https://app.supabase.com/project/').split('.')[0]}`);
  } else {
    console.log('✅ Migration completed successfully');
  }
}

runMigration().catch(console.error);
