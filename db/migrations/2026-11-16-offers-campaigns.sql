-- =============================================================================
-- Migration: Offers, birthday and zodiac campaigns, and offers to people who have bought (lib/offers/)
-- Date: 2026-11-16 · Run AFTER 2026-11-16-preview-offers.sql · Safe to re-run. Rollback at the bottom.
--
-- Adds, on top of the phase-1 Offers tables:
--   preview_email_requests.pet_birth_*      the pet's birthday when the visitor told us (optional; month and day are enough)
--   email_preferences.photo_words_shown_at  when this address was shown the words that say we keep the pet's photo, and
--   email_preferences.photo_words_source    where: 'preview_card' (confirmed a preview email), 'checkout' (paid under the new
--                                           checkout wording) or 'notice_email' (the one-off "Tell past buyers" email)
--   email_preferences.photo_offers_opt_out_at  "Please don't reuse my photo" / the switch on the email preferences page. Stops
--                                           photo offers for this address and leaves every other email alone.
--   email_preferences.pet_birth_*           a birthday given through the link in an offer email, for people with no saved pet
--                                           (buyers who never made an account have no other place to keep it)
--   preview_offers                          request_id and source_custom_image_id may now be empty (a buyer's offer has no preview
--                                           email request, and its photo may be a saved pet's), source_pet_id, audience
--                                           ('previewer' | 'buyer'), event_date (the birthday / start of the sign: an offer is
--                                           not sent after it), and rounds 'birthday:<year>' and 'zodiac:<sign>:<year>'
--   offer_campaigns.kind / audience / enabled   'manual' (hand-started, as before) or the two built-in automatic campaigns
--                                           'birthday' and 'zodiac' (one row each, off until switched on in Admin > Offers)
-- Nothing is generated or sent until Offers is switched on (offers_enabled), and the automatic campaigns have their own switches.
-- =============================================================================
BEGIN;

-- ---- the pet's birthday on a preview request ----------------------------------------------------
ALTER TABLE public.preview_email_requests ADD COLUMN IF NOT EXISTS pet_birth_month smallint CHECK (pet_birth_month BETWEEN 1 AND 12);
ALTER TABLE public.preview_email_requests ADD COLUMN IF NOT EXISTS pet_birth_day   smallint CHECK (pet_birth_day BETWEEN 1 AND 31);
ALTER TABLE public.preview_email_requests ADD COLUMN IF NOT EXISTS pet_birth_year  smallint CHECK (pet_birth_year BETWEEN 1980 AND 2100);

-- ---- what each address has been shown, and their photo choice -----------------------------------
ALTER TABLE public.email_preferences ADD COLUMN IF NOT EXISTS photo_words_shown_at timestamptz;
ALTER TABLE public.email_preferences ADD COLUMN IF NOT EXISTS photo_words_source text CHECK (photo_words_source IN ('preview_card', 'checkout', 'notice_email'));
ALTER TABLE public.email_preferences ADD COLUMN IF NOT EXISTS photo_offers_opt_out_at timestamptz;
ALTER TABLE public.email_preferences ADD COLUMN IF NOT EXISTS pet_birth_month smallint CHECK (pet_birth_month BETWEEN 1 AND 12);
ALTER TABLE public.email_preferences ADD COLUMN IF NOT EXISTS pet_birth_day   smallint CHECK (pet_birth_day BETWEEN 1 AND 31);
ALTER TABLE public.email_preferences ADD COLUMN IF NOT EXISTS pet_birth_year  smallint CHECK (pet_birth_year BETWEEN 1980 AND 2100);
CREATE INDEX IF NOT EXISTS email_preferences_photo_shown_idx ON public.email_preferences (photo_words_shown_at) WHERE photo_words_shown_at IS NOT NULL;

-- ---- campaigns: manual (as before) or one of the two automatic ones -----------------------------
ALTER TABLE public.offer_campaigns ADD COLUMN IF NOT EXISTS kind     text    NOT NULL DEFAULT 'manual' CHECK (kind IN ('manual', 'birthday', 'zodiac'));
ALTER TABLE public.offer_campaigns ADD COLUMN IF NOT EXISTS audience text    NOT NULL DEFAULT 'both'   CHECK (audience IN ('previewers', 'buyers', 'both'));
ALTER TABLE public.offer_campaigns ADD COLUMN IF NOT EXISTS enabled  boolean NOT NULL DEFAULT false;      -- the on/off switch of an automatic campaign
CREATE UNIQUE INDEX IF NOT EXISTS offer_campaigns_auto_kind_idx ON public.offer_campaigns (kind) WHERE kind <> 'manual';

-- ---- offers: for buyers too, and the new rounds -------------------------------------------------
ALTER TABLE public.preview_offers ALTER COLUMN request_id DROP NOT NULL;
ALTER TABLE public.preview_offers ALTER COLUMN source_custom_image_id DROP NOT NULL;
ALTER TABLE public.preview_offers ADD COLUMN IF NOT EXISTS source_pet_id uuid REFERENCES public.pets(id) ON DELETE SET NULL;   -- a saved pet's photo, when no customisation is the source
ALTER TABLE public.preview_offers ADD COLUMN IF NOT EXISTS audience text NOT NULL DEFAULT 'previewer' CHECK (audience IN ('previewer', 'buyer'));
ALTER TABLE public.preview_offers ADD COLUMN IF NOT EXISTS event_date date;                -- birthday / start of the sign: not sent after this day

ALTER TABLE public.preview_offers DROP CONSTRAINT IF EXISTS preview_offers_round_check;
ALTER TABLE public.preview_offers ADD CONSTRAINT preview_offers_round_check
  CHECK (round IN ('1', '2') OR round LIKE 'campaign:%' OR round LIKE 'birthday:%' OR round LIKE 'zodiac:%');

ALTER TABLE public.preview_offers DROP CONSTRAINT IF EXISTS preview_offers_has_photo_check;
ALTER TABLE public.preview_offers ADD CONSTRAINT preview_offers_has_photo_check
  CHECK (source_custom_image_id IS NOT NULL OR source_pet_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS preview_offers_audience_idx ON public.preview_offers (audience);

COMMIT;

-- Rollback (run manually; offers for buyers and the automatic campaigns are deleted first, as the old columns could not hold them):
-- DELETE FROM public.preview_offers WHERE audience = 'buyer' OR round LIKE 'birthday:%' OR round LIKE 'zodiac:%' OR request_id IS NULL OR source_custom_image_id IS NULL;
-- DELETE FROM public.offer_campaigns WHERE kind <> 'manual';
-- ALTER TABLE public.preview_offers DROP CONSTRAINT IF EXISTS preview_offers_has_photo_check;
-- ALTER TABLE public.preview_offers DROP CONSTRAINT IF EXISTS preview_offers_round_check;
-- ALTER TABLE public.preview_offers ADD CONSTRAINT preview_offers_round_check CHECK (round IN ('1', '2') OR round LIKE 'campaign:%');
-- DROP INDEX IF EXISTS public.preview_offers_audience_idx;
-- ALTER TABLE public.preview_offers DROP COLUMN IF EXISTS event_date;
-- ALTER TABLE public.preview_offers DROP COLUMN IF EXISTS audience;
-- ALTER TABLE public.preview_offers DROP COLUMN IF EXISTS source_pet_id;
-- ALTER TABLE public.preview_offers ALTER COLUMN source_custom_image_id SET NOT NULL;
-- ALTER TABLE public.preview_offers ALTER COLUMN request_id SET NOT NULL;
-- DROP INDEX IF EXISTS public.offer_campaigns_auto_kind_idx;
-- ALTER TABLE public.offer_campaigns DROP COLUMN IF EXISTS enabled;
-- ALTER TABLE public.offer_campaigns DROP COLUMN IF EXISTS audience;
-- ALTER TABLE public.offer_campaigns DROP COLUMN IF EXISTS kind;
-- DROP INDEX IF EXISTS public.email_preferences_photo_shown_idx;
-- ALTER TABLE public.email_preferences DROP COLUMN IF EXISTS pet_birth_year, DROP COLUMN IF EXISTS pet_birth_day, DROP COLUMN IF EXISTS pet_birth_month;
-- ALTER TABLE public.email_preferences DROP COLUMN IF EXISTS photo_offers_opt_out_at, DROP COLUMN IF EXISTS photo_words_source, DROP COLUMN IF EXISTS photo_words_shown_at;
-- ALTER TABLE public.preview_email_requests DROP COLUMN IF EXISTS pet_birth_year, DROP COLUMN IF EXISTS pet_birth_day, DROP COLUMN IF EXISTS pet_birth_month;
