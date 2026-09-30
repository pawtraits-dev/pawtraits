-- =============================================================================
-- Widen product_pricing margin columns.
-- profit_margin_percent / markup_percent were DECIMAL(5,2) (max 999.99), so a self-print
-- product with a low unit cost (e.g. £25 price, £2 cost → 1,150% markup) failed to save with
-- "numeric field overflow". The current_product_pricing view selects pp.*, so it is
-- dropped and recreated around the change with its existing definition.
-- Safe to re-run.
-- =============================================================================
BEGIN;

DO $$
DECLARE
  view_sql text;
BEGIN
  IF to_regclass('public.current_product_pricing') IS NOT NULL THEN
    view_sql := pg_get_viewdef('public.current_product_pricing'::regclass, true);
    DROP VIEW public.current_product_pricing;
  END IF;

  ALTER TABLE public.product_pricing
    ALTER COLUMN profit_margin_percent TYPE numeric(10,2),
    ALTER COLUMN markup_percent TYPE numeric(10,2);

  IF view_sql IS NOT NULL THEN
    EXECUTE 'CREATE VIEW public.current_product_pricing AS ' || view_sql;
    GRANT SELECT ON public.current_product_pricing TO anon, authenticated, service_role;
  END IF;
END $$;

COMMIT;

-- Afterwards, re-save any product in /admin/products that shows "No price".
