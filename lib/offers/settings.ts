/** Offers: settings, constants and the "migration not run yet" check (server only). See db/migrations/2026-11-16-preview-offers.sql. */
import { linkBaseUrl } from '@/lib/site-url';
import { getSetting } from '@/lib/app-settings';

export const DAY_MS = 24 * 60 * 60 * 1000;
/** Pictures in one offer, and the fewest that make an offer worth sending */
export const OFFER_PICTURES = 3;
export const MIN_PICTURES = 2;
/** At least this many days between two offer emails to one address, of any kind */
export const MIN_GAP_DAYS = 7;

export const MIGRATION_FILE = 'db/migrations/2026-11-16-preview-offers.sql';
/** The second migration: buyers, birthdays, the automatic campaigns */
export const CAMPAIGNS_MIGRATION_FILE = 'db/migrations/2026-11-16-offers-campaigns.sql';
/** An error that means the migration has not been run */
export const MISSING = /preview_offers|offer_campaigns|photo_offers_ok|offers_stopped_at|photo_words_shown_at|photo_offers_opt_out_at|pet_birth_|source_pet_id|event_date|audience/;

export interface OfferSettings {
  enabled: boolean;
  autoSend: boolean;
  round1Days: number;
  round2Days: number;
  perRun: number;
  perDay: number;
  /** days before the start of the pet's sign that the zodiac offer is due */
  zodiacDaysBefore: number;
  /** days before the pet's birthday that the birthday offer is due */
  birthdayDaysBefore: number;
  /** days after a buyer was shown the photo wording before they can be offered anything */
  noticeGraceDays: number;
}

export async function loadOfferSettings(): Promise<OfferSettings> {
  const [enabled, autoSend, round1Days, round2Days, perRun, perDay, zodiacDaysBefore, birthdayDaysBefore, noticeGraceDays] = await Promise.all([
    getSetting('offers_enabled'), getSetting('offers_auto_send'), getSetting('offers_round1_days'),
    getSetting('offers_round2_days'), getSetting('offers_per_run'), getSetting('offers_per_day'),
    getSetting('offers_zodiac_days_before'), getSetting('offers_birthday_days_before'), getSetting('offers_notice_grace_days'),
  ]);
  return { enabled: enabled === true, autoSend: autoSend === true, round1Days, round2Days, perRun, perDay, zodiacDaysBefore, birthdayDaysBefore, noticeGraceDays };
}

/** Offer emails are sent from the cron and admin actions (no visitor request): a preview deployment links back to itself (lib/site-url.ts) */
export const siteUrl = () => linkBaseUrl();
