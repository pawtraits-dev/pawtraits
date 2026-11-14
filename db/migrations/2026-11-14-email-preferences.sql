-- =============================================================================
-- Migration: Email preferences and the suppression list (lib/marketing/)
-- Date: 2026-11-14 · Safe to re-run.
--
-- email_preferences        one row per address that has said yes (status 'subscribed') or has
--                          unsubscribed (status 'unsubscribed': this IS the suppression list).
--                          No row = never asked = no marketing email. Addresses are stored lower-cased.
-- email_preference_events  append-only history: who agreed to what, in which words, and when.
--
-- Who is subscribed: buyers are subscribed when their order is paid unless they ticked "No thanks, just my
-- order emails" (basis 'soft_opt_in'); anyone who has not bought is subscribed only by a tick or the
-- preferences page (basis 'consent'). An unsubscribed address is never re-subscribed by a purchase.
-- Marketing email is only ever sent to a 'subscribed' address whose topic is on (canEmail()).
-- Order emails, receipts, download links, sign-in links and account messages are not marketing.
-- Both tables are service-role only (RLS on, no public policies), like social_opt_outs.
-- =============================================================================
BEGIN;

CREATE TABLE IF NOT EXISTS public.email_preferences (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email              text NOT NULL UNIQUE CHECK (email = lower(btrim(email))),
  customer_id        uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  status             text NOT NULL CHECK (status IN ('subscribed', 'unsubscribed')),
  topics             jsonb NOT NULL DEFAULT '{"new_designs": true, "pet_days": true, "offers": true}'::jsonb,
  basis              text CHECK (basis IN ('soft_opt_in', 'consent')),  -- 'soft_opt_in': bought from us and did not say no at checkout; 'consent': ticked yes / said yes on the preferences page
  consent_source     text,          -- 'checkout', 'quiz_save', 'preferences_page', 'account', 'checkout_legacy'
  consent_wording    text,          -- the exact words shown with the tick box
  consent_version    text,
  consented_at       timestamptz,
  unsubscribed_at    timestamptz,
  unsubscribe_source text,          -- 'email_link', 'one_click', 'preferences_page', 'account', 'admin'
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS email_preferences_customer_idx ON public.email_preferences (customer_id);
CREATE INDEX IF NOT EXISTS email_preferences_status_idx ON public.email_preferences (status);

CREATE TABLE IF NOT EXISTS public.email_preference_events (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email      text NOT NULL,
  action     text NOT NULL CHECK (action IN ('subscribed', 'unsubscribed', 'topics_changed', 'declined')),   -- 'declined': ticked "No thanks" at checkout (nothing else changes)
  source     text,
  basis      text,
  wording    text,
  topics     jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS email_preference_events_email_idx ON public.email_preference_events (email, created_at DESC);

ALTER TABLE public.email_preferences       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_preference_events ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.email_preferences, public.email_preference_events TO service_role;

-- Everyone who ticked the box at an earlier checkout (customers.marketing_consent) is kept as subscribed
INSERT INTO public.email_preferences (email, customer_id, status, basis, consent_source, consent_wording, consent_version, consented_at)
SELECT lower(btrim(c.email)), c.id, 'subscribed', 'consent', 'checkout_legacy', 'Ticked the marketing box at checkout (before email preferences existed)', 'legacy', COALESCE(c.created_at, now())
FROM public.customers c
WHERE c.marketing_consent = true AND c.email IS NOT NULL AND btrim(c.email) <> ''
ON CONFLICT (email) DO NOTHING;

INSERT INTO public.email_preference_events (email, action, source, basis, wording, topics)
SELECT p.email, 'subscribed', 'checkout_legacy', 'consent', p.consent_wording, p.topics
FROM public.email_preferences p
WHERE p.consent_source = 'checkout_legacy'
  AND NOT EXISTS (SELECT 1 FROM public.email_preference_events e WHERE e.email = p.email);

COMMIT;

-- Rollback (run manually; this deletes the suppression list, so only before any marketing email has gone out):
-- DROP TABLE IF EXISTS public.email_preference_events;
-- DROP TABLE IF EXISTS public.email_preferences;
