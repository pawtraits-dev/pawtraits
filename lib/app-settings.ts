import { serviceClient } from '@/lib/qr/server';

/**
 * Admin-controlled settings stored in public.app_settings (key → jsonb).
 * Server-side only. Values are cached per server instance for 60s.
 */
export const SETTING_DEFAULTS = {
  guest_preview_daily_limit: 20,
  guest_preview_ip_daily_limit: 200,
  stall_prices_pence: { S: 2500, M: 3500, L: 5000 } as Record<'S' | 'M' | 'L', number>,
  stall_online_discount_pct: 0,
  welcome_gift_enabled: true,
  /** Where new paid orders with posted prints go */
  default_fulfillment_provider: 'self_print' as FulfillmentProvider,
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
  /** Collections: tag new catalogue designs automatically (collections, team, descriptive tags) */
  auto_tag_enabled: true,
  /** Collections: customers can change a sports design to another team */
  team_switch_enabled: true,
  /** New team versions one visitor can have painted per hour (ready-made ones are unlimited) */
  team_switch_hourly_limit: 6,
};
export type FulfillmentProvider = 'self_print' | 'gelato';
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
    case 'default_fulfillment_provider':
      return value === 'self_print' || value === 'gelato' ? null : 'Must be "self_print" or "gelato"';
    case 'social_hero_item_id':
      return value === '' || (typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value)) ? null : 'Must be a social item id or empty';
    case 'return_address':
      return typeof value === 'string' && value.length <= 160 ? null : 'Must be text, 160 characters max';
    case 'welcome_gift_enabled':
    case 'social_feed_enabled':
    case 'social_instagram_enabled':
    case 'social_photo_check_enabled':
    case 'auto_tag_enabled':
    case 'team_switch_enabled':
    case 'social_include_previews':
      return typeof value === 'boolean' ? null : 'Must be true or false';
    case 'stall_prices_pence': {
      const v = value as Record<string, unknown>;
      if (!v || typeof v !== 'object') return 'Must be an object of S/M/L prices';
      for (const s of ['S', 'M', 'L']) {
        if (!Number.isInteger(v[s]) || (v[s] as number) < 100 || (v[s] as number) > 100000) return `Price for ${s} must be 100–100000 pence`;
      }
      return null;
    }
    default:
      return 'Unknown setting';
  }
}
