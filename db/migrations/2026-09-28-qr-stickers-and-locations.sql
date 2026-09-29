-- =============================================================================
-- Migration: QR stickers, point-of-sale locations and scan attribution
-- Date: 2026-09-28
-- Spec:  docs/specs/qr-stickers.md
-- Safe to re-run (IF NOT EXISTS / idempotent backfill). Rollback at bottom.
-- Table names match docs/specs/stock-print-batches.md so that work builds on this.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Stock ref: a short, unique, human-friendly number per image (1001, 1002…)
--    The QR code encodes this ref, not the UUID, so stickers stay small and
--    scannable and never need reprinting if internals change.
-- -----------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS public.image_catalog_stock_ref_seq START 1001;

ALTER TABLE public.image_catalog
  ADD COLUMN IF NOT EXISTS stock_ref integer;

-- Backfill existing images in creation order (re-run safe: continues from max)
WITH base AS (
  SELECT COALESCE(MAX(stock_ref), 1000) AS start_at FROM public.image_catalog
),
ordered AS (
  SELECT ic.id,
         base.start_at + ROW_NUMBER() OVER (ORDER BY ic.created_at, ic.id) AS new_ref
  FROM public.image_catalog ic, base
  WHERE ic.stock_ref IS NULL
)
UPDATE public.image_catalog ic
SET stock_ref = ordered.new_ref
FROM ordered
WHERE ic.id = ordered.id;

-- Move the sequence past the backfilled refs
SELECT setval('public.image_catalog_stock_ref_seq',
              GREATEST((SELECT COALESCE(MAX(stock_ref), 1000) FROM public.image_catalog), 1000));

ALTER SEQUENCE public.image_catalog_stock_ref_seq OWNED BY public.image_catalog.stock_ref;

ALTER TABLE public.image_catalog
  ALTER COLUMN stock_ref SET DEFAULT nextval('public.image_catalog_stock_ref_seq'),
  ALTER COLUMN stock_ref SET NOT NULL;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'image_catalog_stock_ref_key') THEN
    ALTER TABLE public.image_catalog ADD CONSTRAINT image_catalog_stock_ref_key UNIQUE (stock_ref);
  END IF;
END $$;

COMMENT ON COLUMN public.image_catalog.stock_ref IS
  'Short public reference used in sticker QR codes (/s/{stock_ref}). Assigned automatically; never reuse or change once stickers are printed.';

-- -----------------------------------------------------------------------------
-- 2. Point-of-sale / stock locations (stalls, studio, later partner premises)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stock_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE CHECK (code ~ '^[A-Z0-9]{2,8}$'),   -- goes in the QR, e.g. CAMDEN
  name text NOT NULL,
  location_type text NOT NULL CHECK (location_type IN ('studio','stall','partner','other')),
  partner_id uuid REFERENCES public.partners(id),                 -- phase 2: partner premises
  at_market_discount_pct numeric NOT NULL DEFAULT 0
    CHECK (at_market_discount_pct BETWEEN 0 AND 100),
  address text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.stock_locations (code, name, location_type)
VALUES ('STUDIO', 'Studio (home stock)', 'studio')
ON CONFLICT (code) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 3. Every sticker scan (one row per scan; replaces the counter-only
--    qr_code_tracking table for sticker purposes)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.qr_scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  image_id uuid REFERENCES public.image_catalog(id) ON DELETE SET NULL,
  stock_ref integer NOT NULL,                      -- as scanned (kept even if image later removed)
  size_code text CHECK (size_code IS NULL OR size_code IN ('S','M','L')),
  location_id uuid REFERENCES public.stock_locations(id) ON DELETE SET NULL,
  location_code text,                              -- raw code from the QR, kept even if unknown
  visitor_id uuid NOT NULL,                        -- first-party cookie pt_vid
  is_repeat boolean NOT NULL DEFAULT false,        -- same visitor + ref within 30 min
  is_bot boolean NOT NULL DEFAULT false,           -- link previewers / crawlers
  user_agent text,
  referer text,
  ip_hash text,                                    -- SHA-256 of IP + salt, never the raw IP
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  converted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS qr_scans_location_created_idx ON public.qr_scans (location_id, created_at);
CREATE INDEX IF NOT EXISTS qr_scans_image_created_idx    ON public.qr_scans (image_id, created_at);
CREATE INDEX IF NOT EXISTS qr_scans_visitor_created_idx  ON public.qr_scans (visitor_id, created_at);
CREATE INDEX IF NOT EXISTS qr_scans_order_idx            ON public.qr_scans (order_id) WHERE order_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 4. Order attribution
-- -----------------------------------------------------------------------------
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS pos_location_id uuid REFERENCES public.stock_locations(id),
  ADD COLUMN IF NOT EXISTS qr_scan_id uuid REFERENCES public.qr_scans(id);

CREATE INDEX IF NOT EXISTS orders_pos_location_idx ON public.orders (pos_location_id)
  WHERE pos_location_id IS NOT NULL;

COMMENT ON COLUMN public.orders.pos_location_id IS
  'Stall/location whose sticker QR the customer last scanned within the attribution window (30 days) before ordering.';

-- -----------------------------------------------------------------------------
-- 5. RLS — API routes use the service role (bypasses RLS); admins can read/manage
-- -----------------------------------------------------------------------------
ALTER TABLE public.stock_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qr_scans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS stock_locations_admin_all ON public.stock_locations;
CREATE POLICY stock_locations_admin_all ON public.stock_locations
  FOR ALL USING (EXISTS (SELECT 1 FROM public.user_profiles
                         WHERE user_id = auth.uid() AND user_type = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_profiles
                      WHERE user_id = auth.uid() AND user_type = 'admin'));

DROP POLICY IF EXISTS qr_scans_admin_select ON public.qr_scans;
CREATE POLICY qr_scans_admin_select ON public.qr_scans
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.user_profiles
                            WHERE user_id = auth.uid() AND user_type = 'admin'));

-- -----------------------------------------------------------------------------
-- 6. Reporting view: per location per day
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.qr_location_daily
WITH (security_invoker = true) AS
SELECT
  s.location_id,
  COALESCE(l.code, s.location_code, 'NONE')           AS location_code,
  (s.created_at AT TIME ZONE 'Europe/London')::date   AS day,
  COUNT(*) FILTER (WHERE NOT s.is_bot)                AS scans,
  COUNT(DISTINCT s.visitor_id) FILTER (WHERE NOT s.is_bot) AS unique_visitors,
  COUNT(DISTINCT s.order_id)                          AS orders,
  COALESCE(SUM(o.total_amount) FILTER (WHERE o.payment_status = 'paid'), 0) AS revenue_pence
FROM public.qr_scans s
LEFT JOIN public.stock_locations l ON l.id = s.location_id
LEFT JOIN public.orders o ON o.id = s.order_id
GROUP BY 1, 2, 3;

COMMIT;

-- =============================================================================
-- ROLLBACK (run manually if needed)
-- =============================================================================
-- BEGIN;
-- DROP VIEW IF EXISTS public.qr_location_daily;
-- ALTER TABLE public.orders DROP COLUMN IF EXISTS qr_scan_id, DROP COLUMN IF EXISTS pos_location_id;
-- DROP TABLE IF EXISTS public.qr_scans;
-- DROP TABLE IF EXISTS public.stock_locations;
-- ALTER TABLE public.image_catalog DROP CONSTRAINT IF EXISTS image_catalog_stock_ref_key;
-- ALTER TABLE public.image_catalog DROP COLUMN IF EXISTS stock_ref;   -- also drops the owned sequence
-- COMMIT;
