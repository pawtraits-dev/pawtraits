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
};
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
      return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 10000 ? null : 'Must be a whole number 0–10000';
    case 'stall_online_discount_pct':
      return typeof value === 'number' && value >= 0 && value <= 100 ? null : 'Must be 0–100';
    case 'welcome_gift_enabled':
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
