-- =============================================================================
-- Migration: Trade print orders (foamex stall stock from the UK trade printer)
-- Date: 2026-10-22. Safe to re-run. Rollback at bottom.
--
-- Fulfilment model: Gelato prints online orders (all art and non-art products, including
-- foamex bought online). Foamex stock for the stalls comes from a UK trade printer, ordered by
-- hand. Admin → Stock & Stalls → Trade print orders builds each order: designs picked from the
-- catalogue and/or the stall sales of a period to replace, in S / M / L / XL, then downloads
-- print-ready files (exact size, 300 dpi, no bleed) and an order sheet to upload to the printer.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.trade_print_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ref text NOT NULL UNIQUE,                         -- TP-20261022-1
  printer text NOT NULL DEFAULT 'Trade printer',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'downloaded', 'ordered', 'received', 'cancelled')),
  sales_from date,                                  -- stall sales replaced (when used)
  sales_to date,
  sales_location_ids uuid[],                        -- null = every stall
  notes text,
  printer_order_ref text,                           -- the printer's own order number
  downloaded_at timestamptz,
  ordered_at timestamptz,
  received_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.trade_print_order_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.trade_print_orders(id) ON DELETE CASCADE,
  image_id uuid NOT NULL REFERENCES public.image_catalog(id),
  size text NOT NULL CHECK (size IN ('S', 'M', 'L', 'XL')),
  quantity integer NOT NULL CHECK (quantity BETWEEN 1 AND 999),
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'sales')),
  sold integer,                                     -- units sold in the period (sales lines)
  source_px integer[],                              -- [width, height] of the design, cached
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id, image_id, size)
);
CREATE INDEX IF NOT EXISTS trade_print_order_lines_order_idx ON public.trade_print_order_lines (order_id);

ALTER TABLE public.trade_print_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_print_order_lines ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.trade_print_orders, public.trade_print_order_lines TO service_role;

-- Stall sales are order lines for stall_print_<size> products; find them by date quickly
CREATE INDEX IF NOT EXISTS order_items_stall_idx ON public.order_items (product_id, created_at)
  WHERE product_id LIKE 'stall_print_%';

COMMIT;

-- Rollback:
-- DROP TABLE IF EXISTS public.trade_print_order_lines;
-- DROP TABLE IF EXISTS public.trade_print_orders;
-- DROP INDEX IF EXISTS public.order_items_stall_idx;
