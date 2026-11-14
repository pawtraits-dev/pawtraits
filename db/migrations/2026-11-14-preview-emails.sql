-- =============================================================================
-- Migration: "Email me this preview" (lib/previews/) · Date: 2026-11-14 · Safe to re-run.
--
-- One row per (preview, address) the visitor asked us to email. It holds what the signed link, the abuse
-- limits, a pending marketing tick (confirmed only when the link is opened) and the later follow-up
-- emails need. The address is lower-cased; the link in the email carries the row id, never the address.
-- Service role only (RLS on, no public policies).
-- =============================================================================
BEGIN;

CREATE TABLE IF NOT EXISTS public.preview_email_requests (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  custom_image_id       uuid NOT NULL REFERENCES public.customer_custom_images(id) ON DELETE CASCADE,
  email                 text NOT NULL CHECK (email = lower(btrim(email))),
  guest_session_id      uuid,                 -- the device that asked (pt_vid)
  customer_id           uuid,                 -- when a signed-in customer asked
  marketing_ticked      boolean NOT NULL DEFAULT false,   -- ticked "Yes please": pending until the link is opened
  marketing_confirmed_at timestamptz,         -- the link was opened and the address subscribed (explicit opt-in)
  qr_scan_id            uuid,                 -- stall attribution at the time of asking
  pos_location_id       uuid,
  qr_attribution        jsonb,                -- the signed cookie's content (scanId, imageId, locationId, size, ts) to restore on the other device
  send_count            integer NOT NULL DEFAULT 0,
  sends                 jsonb NOT NULL DEFAULT '[]'::jsonb,   -- ISO times of the last sends (for the per-address daily limit)
  last_sent_at          timestamptz,
  opened_at             timestamptz,          -- first time the link was opened by a person
  last_opened_at        timestamptz,
  open_count            integer NOT NULL DEFAULT 0,
  ip_hash               text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (custom_image_id, email)
);
CREATE INDEX IF NOT EXISTS preview_email_requests_email_idx   ON public.preview_email_requests (email);
CREATE INDEX IF NOT EXISTS preview_email_requests_created_idx ON public.preview_email_requests (created_at);
CREATE INDEX IF NOT EXISTS preview_email_requests_guest_idx   ON public.preview_email_requests (guest_session_id, last_sent_at);

ALTER TABLE public.preview_email_requests ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.preview_email_requests TO service_role;

COMMIT;

-- Rollback (run manually): DROP TABLE IF EXISTS public.preview_email_requests;
