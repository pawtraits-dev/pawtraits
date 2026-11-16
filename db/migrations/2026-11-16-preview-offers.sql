-- =============================================================================
-- Migration: Offers, new Pawtraits painted from a photo we already have (lib/offers/)
-- Date: 2026-11-16 · Safe to re-run. Rollback at the bottom.
--
-- When someone asks for a preview to be emailed (under the wording that says we keep the photo),
-- Pawcasso can paint their pet into a few more designs and email those as offers.
--   preview_email_requests.photo_offers_ok   true only when they asked under the NEW wording (guests; requests made
--                                            before this change stay false and are never used for offers)
--   preview_email_requests.offers_stopped_at "Stop offers for this person" in Admin > Offers
--   preview_offers                           one row per (person, round): round '1', '2' or 'campaign:<campaign id>'.
--                                            queued > generating > ready > approved > sent (or skipped / failed)
--   offer_campaigns                          hand-started campaigns (Christmas, Valentine's, Mother's Day...)
-- Nothing is generated or sent until Offers is switched on in Admin > Offers (setting offers_enabled).
-- Service role only (RLS on, no public policies), like preview_email_requests.
-- =============================================================================
BEGIN;

ALTER TABLE public.preview_email_requests ADD COLUMN IF NOT EXISTS photo_offers_ok boolean NOT NULL DEFAULT false;
ALTER TABLE public.preview_email_requests ADD COLUMN IF NOT EXISTS offers_stopped_at timestamptz;

CREATE TABLE IF NOT EXISTS public.offer_campaigns (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  subject         text,                      -- optional email subject (otherwise the standard one)
  intro           text,                      -- optional one line of email copy
  design_ids      uuid[] NOT NULL DEFAULT '{}',   -- catalogue designs to draw from
  collection_path text,                      -- and/or a collection (e.g. 'occasions/christmas'): its designs are drawn from too
  status          text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'running', 'done')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  started_at      timestamptz
);

CREATE TABLE IF NOT EXISTS public.preview_offers (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email                 text NOT NULL CHECK (email = lower(btrim(email))),
  request_id            uuid NOT NULL REFERENCES public.preview_email_requests(id) ON DELETE CASCADE,
  source_custom_image_id uuid NOT NULL REFERENCES public.customer_custom_images(id) ON DELETE CASCADE,   -- the preview whose photo is reused
  round                 text NOT NULL CHECK (round IN ('1', '2') OR round LIKE 'campaign:%'),
  campaign_id           uuid REFERENCES public.offer_campaigns(id) ON DELETE SET NULL,
  status                text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'generating', 'ready', 'approved', 'sent', 'skipped', 'failed')),
  designs               jsonb NOT NULL DEFAULT '[]'::jsonb,   -- [{ id, reason }]: the chosen catalogue designs and why
  custom_image_ids      uuid[] NOT NULL DEFAULT '{}',         -- the generated previews
  error                 text,
  due_at                timestamptz NOT NULL DEFAULT now(),
  generated_at          timestamptz,
  approved_at           timestamptz,
  approved_by           text,
  sent_at               timestamptz,
  opened_at             timestamptz,
  clicked_at            timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (email, round)
);
CREATE INDEX IF NOT EXISTS preview_offers_status_idx  ON public.preview_offers (status);
CREATE INDEX IF NOT EXISTS preview_offers_due_idx     ON public.preview_offers (due_at);
CREATE INDEX IF NOT EXISTS preview_offers_request_idx ON public.preview_offers (request_id);

ALTER TABLE public.offer_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preview_offers  ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.offer_campaigns, public.preview_offers TO service_role;

COMMIT;

-- Rollback (run manually; this deletes every offer and campaign):
-- DROP TABLE IF EXISTS public.preview_offers;
-- DROP TABLE IF EXISTS public.offer_campaigns;
-- ALTER TABLE public.preview_email_requests DROP COLUMN IF EXISTS offers_stopped_at;
-- ALTER TABLE public.preview_email_requests DROP COLUMN IF EXISTS photo_offers_ok;
