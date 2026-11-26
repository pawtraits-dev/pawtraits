import { serviceClient } from '@/lib/qr/server';
import { cleanPct } from '@/lib/referrals/rates';
import { DEFAULT_SELF_PRINT_MATERIALS } from '@/lib/fulfillment/shared';
import { DEFAULT_MULTIBUY_PENCE, validateMultibuyPence } from '@/lib/stall/multibuy';

/**
 * Admin-controlled settings stored in public.app_settings (key → jsonb).
 * Server-side only. Values are cached per server instance for 60s.
 */
export const SETTING_DEFAULTS = {
  guest_preview_daily_limit: 20,
  guest_preview_ip_daily_limit: 200,
  stall_prices_pence: { S: 2000, M: 3000, L: 4000, XL: 5000 } as Record<'S' | 'M' | 'L', number> & { XL?: number },
  stall_online_discount_pct: 0,
  /** Stall multi-buy: number of stall prints in one basket → TOTAL saving in pence ({} = off). Admin → Guest & Stall Settings. */
  stall_multibuy_pence: DEFAULT_MULTIBUY_PENCE as Record<string, number>,
  welcome_gift_enabled: true,
  /** Where new paid orders with posted prints go */
  default_fulfillment_provider: 'self_print' as FulfillmentMode,
  /** Split mode: materials (media slugs) printed here; everything else goes to Gelato */
  self_print_materials: DEFAULT_SELF_PRINT_MATERIALS as string[],
  /** Printed small under the address label on packing slips ("If undelivered return to: …") */
  return_address: '' as string,
  /** Social loop (Admin → Social): website "recent creations" feed */
  social_feed_enabled: true,
  /** Social loop: post before/after carousels to Instagram (off until the Meta app is connected) */
  social_instagram_enabled: false,
  /** Social loop: automatic photo check before an order is featured */
  social_photo_check_enabled: true,
  /** Social loop: feature free previews (customisations not yet bought) as well as purchases */
  social_include_previews: false,
  /** Social loop: the before/after shown at the top of the home page (Admin → Social); '' = the latest */
  social_hero_item_id: '' as string,
  /** Mugs: blank mug photos the mug mockups are built on (Admin → Mugs → Mockup photos) */
  mug_mockup_photos: {} as Partial<Record<'pet' | 'text', { publicId: string; url: string; width: number; height: number; uploadedAt: string; face?: { x: number; y: number; w: number; h: number }; background?: string }>>,
  /** Collections: tag new catalogue designs automatically (collections, team, descriptive tags) */
  auto_tag_enabled: true,
  /** Collections: customers can change a sports design to another team */
  team_switch_enabled: true,
  /** New team versions one visitor can have painted per hour (ready-made ones are unlimited) */
  team_switch_hourly_limit: 6,
  /** Royal Mail labels (lib/shipping/royal-mail/): Click & Drop service codes per destination
   *  ('' = Click & Drop's own shipping rules choose) and the parcel weight estimate */
  /** Offers (Admin → Offers, lib/offers/): new Pawtraits painted from a photo we already have. Off until switched on: nothing is queued or generated. */
  offers_enabled: false,
  /** Offers: send generated offers without waiting for approval (off = they wait in the approval queue) */
  offers_auto_send: false,
  /** Offers: days after the preview email was opened before round 1 */
  offers_round1_days: 3,
  /** Offers: days after round 1 was sent before round 2 */
  offers_round2_days: 14,
  /** Offers: most people generated in one cron run */
  offers_per_run: 5,
  /** Offers: most people generated in one day */
  offers_per_day: 30,
  /** Offers: the zodiac campaign's offer is due this many days before the start of the pet's sign */
  offers_zodiac_days_before: 14,
  /** Offers: the birthday campaign's offer is due this many days before the pet's next birthday */
  offers_birthday_days_before: 21,
  /** Offers: days after a buyer was shown the photo wording before they can be offered anything */
  offers_notice_grace_days: 2,
  /** Customer referrals: % off a new customer's first order when they use a friend's code (Admin → Customer Referrals) */
  referral_friend_discount_pct: 10,
  /** Customer referrals: store credit for the referrer, as a % of their friend's first order */
  referral_referrer_credit_pct: 10,
  royal_mail: { service_uk: '', service_europe: '', service_world: '', packaging_grams: 120, print_grams_per_100cm2: 25, large_letter_max_prints: 2 } as RoyalMailSettings,
};
export interface RoyalMailSettings {
  service_uk: string; service_europe: string; service_world: string;
  packaging_grams: number; print_grams_per_100cm2: number; large_letter_max_prints: number;
}
export type FulfillmentProvider = 'self_print' | 'gelato';
export type FulfillmentMode = FulfillmentProvider | 'split';
export type SettingKey = keyof typeof SETTING_DEFAULTS;
export type SettingValue<K extends SettingKey> = (typeof SETTING_DEFAULTS)[K];

const cache = new Map<string, { value: unknown; at: number }>();
const TTL_MS = 60_000;

export async function getSetting<K extends SettingKey>(key: K): Promise<SettingValue<K>> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value as SettingValue<K>;
  try {
    const { data, error } = await serviceClient().from('app_settings').select('value').eq('key', key).maybeSingle();
    if (error) throw error;
    const value = (data?.value ?? SETTING_DEFAULTS[key]) as SettingValue<K>;
    cache.set(key, { value, at: Date.now() });
    return value;
  } catch (e) {
    console.warn(`app_settings read failed for ${key}, using default`, e);
    return SETTING_DEFAULTS[key];
  }
}

/** The two customer-referral percentages, read together (each falls back to its default if the read fails). */
export async function referralRates(): Promise<{ friendPct: number; referrerPct: number }> {
  const [friendPct, referrerPct] = await Promise.all([getSetting('referral_friend_discount_pct'), getSetting('referral_referrer_credit_pct')]);
  // Stored values can be strings or out of range: read them the same way the charge and the wording do
  return { friendPct: cleanPct(friendPct, SETTING_DEFAULTS.referral_friend_discount_pct), referrerPct: cleanPct(referrerPct, SETTING_DEFAULTS.referral_referrer_credit_pct) };
}

export async function getAllSettings(): Promise<Record<string, { value: unknown; description: string | null; updated_at: string | null }>> {
  const { data, error } = await serviceClient().from('app_settings').select('key, value, description, updated_at');
  if (error) throw error;
  const out: Record<string, { value: unknown; description: string | null; updated_at: string | null }> = {};
  for (const k of Object.keys(SETTING_DEFAULTS)) out[k] = { value: (SETTING_DEFAULTS as any)[k], description: null, updated_at: null };
  for (const row of data ?? []) out[row.key] = { value: row.value, description: row.description, updated_at: row.updated_at };
  return out;
}

export async function setSetting<K extends SettingKey>(key: K, value: SettingValue<K>): Promise<void> {
  const { error } = await serviceClient()
    .from('app_settings')
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  if (error) throw error;
  cache.delete(key);
}

/** Validation for admin writes — returns an error message or null. */
export function validateSetting(key: string, value: unknown): string | null {
  switch (key) {
    case 'guest_preview_daily_limit':
    case 'guest_preview_ip_daily_limit':
    case 'team_switch_hourly_limit':
      return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 10000 ? null : 'Must be a whole number 0–10000';
    case 'stall_online_discount_pct':
      return typeof value === 'number' && value >= 0 && value <= 100 ? null : 'Must be 0–100';
    case 'stall_multibuy_pence':
      return validateMultibuyPence(value);
    case 'default_fulfillment_provider':
      return value === 'self_print' || value === 'gelato' || value === 'split' ? null : 'Must be "self_print", "gelato" or "split"';
    case 'self_print_materials':
      return Array.isArray(value) && value.length >= 1 && value.length <= 20 && value.every(v => typeof v === 'string' && /^[a-z0-9][a-z0-9-]{0,59}$/.test(v)) ? null : 'Choose at least one material (up to 20)';
    case 'mug_mockup_photos':
      return value && typeof value === 'object' && !Array.isArray(value) ? null : 'Must be an object';
    case 'social_hero_item_id':
      return value === '' || (typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value)) ? null : 'Must be a social item id or empty';
    case 'return_address':
      return typeof value === 'string' && value.length <= 160 ? null : 'Must be text, 160 characters max';
    case 'offers_round1_days':
    case 'offers_round2_days':
      return Number.isInteger(value) && (value as number) >= 1 && (value as number) <= 365 ? null : 'Must be a whole number of days, 1–365';
    case 'offers_zodiac_days_before':
    case 'offers_birthday_days_before':
      return Number.isInteger(value) && (value as number) >= 5 && (value as number) <= 120 ? null : 'Must be a whole number of days, 5–120';
    case 'offers_notice_grace_days':
      return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 30 ? null : 'Must be a whole number of days, 0–30';
    case 'offers_per_run':
      return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 50 ? null : 'Must be a whole number 0–50';
    case 'offers_per_day':
      return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 1000 ? null : 'Must be a whole number 0–1000';
    case 'referral_friend_discount_pct':
    case 'referral_referrer_credit_pct':
      return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 50 ? null : 'Must be a whole number from 0 to 50';
    case 'offers_enabled':
    case 'offers_auto_send':
    case 'welcome_gift_enabled':
    case 'social_feed_enabled':
    case 'social_instagram_enabled':
    case 'social_photo_check_enabled':
    case 'auto_tag_enabled':
    case 'team_switch_enabled':
    case 'social_include_previews':
      return typeof value === 'boolean' ? null : 'Must be true or false';
    case 'royal_mail': {
      const v = value as Record<string, unknown>;
      if (!v || typeof v !== 'object') return 'Must be an object';
      for (const k of ['service_uk', 'service_europe', 'service_world']) if (typeof v[k] !== 'string' || !/^[A-Z0-9]{0,10}$/i.test(v[k] as string)) return `${k}: a Click & Drop service code (letters and numbers, up to 10) or empty`;
      for (const k of ['packaging_grams', 'print_grams_per_100cm2', 'large_letter_max_prints']) if (typeof v[k] !== 'number' || (v[k] as number) < 0 || (v[k] as number) > 5000) return `${k}: a number 0–5000`;
      return null;
    }
    case 'stall_prices_pence': {
      const v = value as Record<string, unknown>;
      if (!v || typeof v !== 'object') return 'Must be an object of S/M/L prices';
      for (const s of ['S', 'M', 'L']) {
        if (!Number.isInteger(v[s]) || (v[s] as number) < 100 || (v[s] as number) > 100000) return `Price for ${s} must be 100–100000 pence`;
      }
      // XL is optional (no XL prints at the stall when it's missing)
      if (v.XL !== undefined && v.XL !== null && (!Number.isInteger(v.XL) || (v.XL as number) < 100 || (v.XL as number) > 100000)) return 'Price for XL must be 100–100000 pence';
      return null;
    }
    default:
      return 'Unknown setting';
  }
}
