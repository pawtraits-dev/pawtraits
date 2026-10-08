-- =============================================================================
-- Migration: AI usage and cost tracking
-- Date: 2026-10-16. Safe to re-run. Rollback at bottom.
--
-- One row per Gemini / Claude call (lib/ai/usage.ts): tokens by type, cost in USD worked out
-- at call time from lib/ai/prices.ts, what the call was for, duration, success or error.
-- Read by Admin → AI costs through ai_usage_summary().
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.ai_usage (
  id                  bigserial PRIMARY KEY,
  created_at          timestamptz NOT NULL DEFAULT now(),
  provider            text NOT NULL CHECK (provider IN ('gemini', 'anthropic')),
  model               text NOT NULL,
  feature             text NOT NULL,
  is_batch            boolean NOT NULL DEFAULT false,
  image_size          text,
  input_tokens        integer NOT NULL DEFAULT 0,
  cached_input_tokens integer NOT NULL DEFAULT 0,
  thinking_tokens     integer NOT NULL DEFAULT 0,
  output_text_tokens  integer NOT NULL DEFAULT 0,
  output_image_tokens integer NOT NULL DEFAULT 0,
  output_images       integer NOT NULL DEFAULT 0,
  cost_input_usd      numeric(12, 6),
  cost_thinking_usd   numeric(12, 6),
  cost_output_usd     numeric(12, 6),
  cost_usd            numeric(12, 6),          -- NULL when the model has no price in lib/ai/prices.ts
  prices_as_of        date,
  success             boolean NOT NULL DEFAULT true,
  error               text,
  duration_ms         integer,
  image_id            uuid,                    -- catalogue design (no FK: rows outlive deletes)
  customer_image_id   uuid,
  batch_job_id        uuid,
  meta                jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS ai_usage_created_at_idx ON public.ai_usage (created_at DESC);
CREATE INDEX IF NOT EXISTS ai_usage_feature_idx ON public.ai_usage (feature, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_usage_customer_image_idx ON public.ai_usage (customer_image_id) WHERE customer_image_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ai_usage_image_idx ON public.ai_usage (image_id) WHERE image_id IS NOT NULL;

-- Server only (service role); no access for browsers
ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_usage FROM anon, authenticated;
GRANT ALL ON public.ai_usage TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.ai_usage_id_seq TO service_role;

-- Totals for a period, grouped by day / feature / model (Admin → AI costs)
CREATE OR REPLACE FUNCTION public.ai_usage_summary(p_from timestamptz, p_to timestamptz)
RETURNS TABLE (day date, feature text, model text, is_batch boolean, calls bigint, failures bigint,
               images bigint, input_tokens bigint, thinking_tokens bigint, output_text_tokens bigint,
               output_image_tokens bigint, cost_input_usd numeric, cost_thinking_usd numeric,
               cost_output_usd numeric, cost_usd numeric, unpriced_calls bigint, avg_duration_ms numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (created_at AT TIME ZONE 'Europe/London')::date, feature, model, is_batch,
         count(*), count(*) FILTER (WHERE NOT success), sum(output_images),
         sum(input_tokens), sum(thinking_tokens), sum(output_text_tokens), sum(output_image_tokens),
         coalesce(sum(cost_input_usd), 0), coalesce(sum(cost_thinking_usd), 0), coalesce(sum(cost_output_usd), 0),
         coalesce(sum(cost_usd), 0), count(*) FILTER (WHERE success AND cost_usd IS NULL), round(avg(duration_ms))
    FROM ai_usage
   WHERE created_at >= p_from AND created_at < p_to
   GROUP BY 1, 2, 3, 4
   ORDER BY 1, 2, 3
$$;
REVOKE ALL ON FUNCTION public.ai_usage_summary(timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ai_usage_summary(timestamptz, timestamptz) TO service_role;

COMMIT;

-- Rollback:
-- DROP FUNCTION IF EXISTS public.ai_usage_summary(timestamptz, timestamptz);
-- DROP TABLE IF EXISTS public.ai_usage;
