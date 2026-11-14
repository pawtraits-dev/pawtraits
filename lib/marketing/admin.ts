/**
 * Admin views of the marketing choice (server only). Reads email_preferences; before the
 * 2026-11-14 migration is run it falls back to customers.marketing_consent so the screens still work.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { normaliseEmail, normaliseTopics, type PreferenceRow } from './preferences';

export interface MarketingState {
  state: 'subscribed' | 'unsubscribed' | 'never';
  subscribed: boolean;
  /** only when the preference table has a row */
  basis: 'soft_opt_in' | 'consent' | null;
  source: string | null;
  at: string | null;
  topics: PreferenceRow['topics'] | null;
}

const NEVER: MarketingState = { state: 'never', subscribed: false, basis: null, source: null, at: null, topics: null };

/** Pure: a row (or the old customers.marketing_consent flag) → what the admin sees */
export function marketingState(row: Partial<PreferenceRow> | null, legacyConsent?: boolean | null): MarketingState {
  if (row?.status === 'subscribed') return { state: 'subscribed', subscribed: true, basis: (row.basis as any) ?? null, source: row.consent_source ?? null, at: row.consented_at ?? null, topics: normaliseTopics(row.topics, false) };
  if (row?.status === 'unsubscribed') return { state: 'unsubscribed', subscribed: false, basis: (row.basis as any) ?? null, source: row.unsubscribe_source ?? null, at: row.unsubscribed_at ?? null, topics: null };
  return legacyConsent ? { ...NEVER, state: 'subscribed', subscribed: true } : NEVER;
}

export async function marketingStates(supabase: SupabaseClient, emails: (string | null | undefined)[]): Promise<Map<string, MarketingState>> {
  const list = Array.from(new Set(emails.map(e => normaliseEmail(e)).filter((e): e is string => !!e)));
  const out = new Map<string, MarketingState>();
  for (let i = 0; i < list.length; i += 100) {
    const chunk = list.slice(i, i + 100);
    const { data, error } = await supabase.from('email_preferences').select('*').in('email', chunk);
    if (error) {
      // Table not there yet: the old flag on the customer
      const { data: cs } = await supabase.from('customers').select('email, marketing_consent').in('email', chunk);
      for (const c of cs ?? []) out.set(String((c as any).email).toLowerCase(), marketingState(null, (c as any).marketing_consent));
      continue;
    }
    const byEmail = new Map((data ?? []).map((r: any) => [r.email, r]));
    for (const e of chunk) out.set(e, marketingState((byEmail.get(e) as any) ?? null));
  }
  return out;
}
