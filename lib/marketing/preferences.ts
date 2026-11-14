/**
 * Marketing email preferences and the suppression list (server only). Tables: email_preferences
 * (one row per address: subscribed or unsubscribed) and email_preference_events (append-only
 * evidence of who agreed to what, in which words, when). See db/migrations/2026-11-14-email-preferences.sql.
 *
 * THE RULES (do not bend them):
 *  - Marketing email goes only to an address that is subscribed: a buyer who did not say "No thanks" at checkout
 *    (basis 'soft_opt_in'), or someone who ticked yes / said yes on the preferences page (basis 'consent').
 *    EVERY marketing send MUST be gated by canEmail(supabase, email, topic). It fails closed.
 *  - Order emails, receipts, download links, sign-in links and account messages are NOT marketing:
 *    they never look at this table.
 *  - An unsubscribe is permanent until the person themselves opts back in. subscribe() and a
 *    setTopics() with something switched on are the only ways back, and are only ever called from a
 *    deliberate tick or the preferences page. A purchase goes through subscribeFromPurchase(), which
 *    never touches an unsubscribed address. Nothing else (import, new account) may subscribe anyone.
 *  - Addresses are matched case-insensitively: stored trimmed and lower-cased.
 *  - Links carry the preference row's id and a signature, never the email address (same approach as
 *    lib/social/opt-out.ts).
 */
import { createHmac, timingSafeEqual } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { CHECKOUT_WORDING, CONSENT_LABEL, CONSENT_VERSION, EMAIL_TOPICS, TOPIC_KEYS, type ConsentBasis, type ConsentSource, type EmailTopic, type EmailTopics, type UnsubscribeSource } from './consent-copy';

export type PrefStatus = 'subscribed' | 'unsubscribed';

export interface PreferenceRow {
  id: string;
  email: string;
  customer_id: string | null;
  status: PrefStatus;
  topics: EmailTopics;
  basis: ConsentBasis | null;
  consent_source: string | null;
  consent_wording: string | null;
  consent_version: string | null;
  consented_at: string | null;
  unsubscribed_at: string | null;
  unsubscribe_source: string | null;
  created_at: string;
  updated_at: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const ALL_TOPICS_ON: EmailTopics = { new_designs: true, pet_days: true, offers: true };

// ---------------------------------------------------------------------------------------------
// Pure helpers (no database)

/** Trimmed, lower-cased, or null when it is not an email address */
export function normaliseEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const e = raw.trim().toLowerCase();
  return e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : null;
}

/** Topics from anything: only booleans count; a topic that isn't given takes `fallback` */
export function normaliseTopics(raw: unknown, fallback = false): EmailTopics {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return Object.fromEntries(TOPIC_KEYS.map(k => [k, typeof o[k] === 'boolean' ? (o[k] as boolean) : fallback])) as EmailTopics;
}

export const allTopicsOff = (t: EmailTopics) => TOPIC_KEYS.every(k => !t[k]);

/** The status that switches imply: all off = unsubscribed */
export const statusForTopics = (t: EmailTopics): PrefStatus => (allTopicsOff(t) ? 'unsubscribed' : 'subscribed');

/** "s•••@gmail.com" */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '•••';
  return `${local.slice(0, 1)}•••@${domain}`;
}

/** Escape % _ \ so an address is matched literally by ilike */
const likeEscape = (s: string) => s.replace(/[\\%_]/g, c => `\\${c}`);

function secret() {
  return process.env.EMAIL_PREFS_SECRET || process.env.SOCIAL_LINK_SECRET || process.env.DOWNLOAD_LINK_SECRET || process.env.QR_ATTRIBUTION_SECRET
    || `emailprefs-${process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(-16) ?? 'dev'}`;
}

export function signPreference(preferenceId: string): string {
  return createHmac('sha256', secret()).update(`email-prefs:${preferenceId}`).digest('base64url').slice(0, 32);
}

export function verifyPreferenceToken(preferenceId: unknown, token: unknown): preferenceId is string {
  if (typeof preferenceId !== 'string' || typeof token !== 'string' || !UUID_RE.test(preferenceId)) return false;
  const a = Buffer.from(signPreference(preferenceId)), b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

const root = (baseUrl: string) => baseUrl.replace(/\/$/, '');
/** The preferences page link: the row id and a signature, never the address */
export const preferencesUrl = (baseUrl: string, preferenceId: string) => `${root(baseUrl)}/email-preferences?p=${preferenceId}&t=${signPreference(preferenceId)}`;
/** The one-click unsubscribe link (POST unsubscribes; GET shows a confirm page) */
export const unsubscribeUrl = (baseUrl: string, preferenceId: string) => `${root(baseUrl)}/api/public/email-preferences/unsubscribe?p=${preferenceId}&t=${signPreference(preferenceId)}`;

/** RFC 8058 headers for a marketing email */
export function listUnsubscribeHeaders(url: string): Record<string, string> {
  return { 'List-Unsubscribe': `<${url}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' };
}

/** True when the address unsubscribed after `at` (when the box was ticked): that tick is out of date and must not re-subscribe */
export function tickIsStale(row: Pick<PreferenceRow, 'status' | 'unsubscribed_at'> | null, at: string): boolean {
  return !!row && row.status === 'unsubscribed' && !!row.unsubscribed_at && Date.parse(row.unsubscribed_at) > Date.parse(at);
}

/** The words stored with a consent given on the preferences page (what was switched on) */
export function pageWording(topics: EmailTopics): string {
  return `Email preferences page: ${EMAIL_TOPICS.filter(t => topics[t.key]).map(t => t.title).join(', ')}`;
}

// ---------------------------------------------------------------------------------------------
// Database

const asRow = (r: any): PreferenceRow => ({ ...r, topics: normaliseTopics(r.topics, false) });

/** The row for an address, or null (never asked, or the table is missing) */
export async function getPreferences(supabase: SupabaseClient, email: string): Promise<PreferenceRow | null> {
  const e = normaliseEmail(email);
  if (!e) return null;
  const { data, error } = await supabase.from('email_preferences').select('*').eq('email', e).maybeSingle();
  return error || !data ? null : asRow(data);
}

export async function getPreferencesById(supabase: SupabaseClient, id: string): Promise<PreferenceRow | null> {
  if (!UUID_RE.test(id)) return null;
  const { data, error } = await supabase.from('email_preferences').select('*').eq('id', id).maybeSingle();
  return error || !data ? null : asRow(data);
}

/**
 * THE GATE: may we send this marketing email to this address? True only when a row exists, it is
 * subscribed, and the topic is on. No row = false. Any error = false (fails closed).
 * Every marketing send must call this; order emails, receipts, downloads and sign-in links must not.
 */
export async function canEmail(supabase: SupabaseClient, email: string, topic: EmailTopic): Promise<boolean> {
  try {
    const row = await getPreferences(supabase, email);
    return !!row && row.status === 'subscribed' && row.topics[topic] === true;
  } catch {
    return false;
  }
}

async function customerIdFor(supabase: SupabaseClient, email: string): Promise<string | null> {
  const { data } = await supabase.from('customers').select('id').ilike('email', likeEscape(email)).limit(1).maybeSingle();
  return (data as any)?.id ?? null;
}

/** Keep customers.marketing_consent in step, so the admin screens stay truthful */
async function syncCustomer(supabase: SupabaseClient, email: string, on: boolean) {
  const { error } = await supabase.from('customers').update({ marketing_consent: on }).ilike('email', likeEscape(email));
  if (error) console.warn('email preferences: customers.marketing_consent not updated', error.message);
}

async function logEvent(supabase: SupabaseClient, e: { email: string; action: 'subscribed' | 'unsubscribed' | 'topics_changed' | 'declined'; source: string; basis?: ConsentBasis | null; wording?: string | null; topics?: EmailTopics | null }) {
  const { error } = await supabase.from('email_preference_events').insert({ email: e.email, action: e.action, source: e.source, basis: e.basis ?? null, wording: e.wording ?? null, topics: e.topics ?? null });
  if (error) console.warn('email preferences: event not recorded', error.message);
}

/**
 * Say yes. Allowed even if the address is unsubscribed, because it is only ever called from a
 * deliberate tick or the preferences page. Records the wording shown and the version.
 */
export async function subscribe(supabase: SupabaseClient, input: { email: string; source: ConsentSource; customerId?: string | null; topics?: Partial<EmailTopics>; wording?: string; basis?: ConsentBasis }): Promise<PreferenceRow> {
  const email = normaliseEmail(input.email);
  if (!email) throw new Error('Not an email address');
  const topics = input.topics ? normaliseTopics(input.topics, false) : ALL_TOPICS_ON;
  if (allTopicsOff(topics)) throw new Error('Pick at least one thing to hear about');
  const wording = input.wording ?? CONSENT_LABEL;
  const now = new Date().toISOString();
  const customerId = input.customerId ?? (await customerIdFor(supabase, email));
  const { data, error } = await supabase.from('email_preferences').upsert({
    email, ...(customerId ? { customer_id: customerId } : {}), status: 'subscribed', topics, basis: input.basis ?? 'consent',
    consent_source: input.source, consent_wording: wording, consent_version: CONSENT_VERSION, consented_at: now,
    unsubscribed_at: null, unsubscribe_source: null, updated_at: now,
  }, { onConflict: 'email' }).select('*').single();
  if (error) throw new Error(error.message);
  await logEvent(supabase, { email, action: 'subscribed', source: input.source, basis: input.basis ?? 'consent', wording, topics });
  await syncCustomer(supabase, email, true);
  return asRow(data);
}

/** Stop all marketing email for an address. Creates the row if there is none: that IS the suppression list. */
export async function unsubscribe(supabase: SupabaseClient, input: { email: string; source: UnsubscribeSource }): Promise<void> {
  const email = normaliseEmail(input.email);
  if (!email) throw new Error('Not an email address');
  const now = new Date().toISOString();
  const customerId = await customerIdFor(supabase, email);
  const { error } = await supabase.from('email_preferences').upsert({
    email, ...(customerId ? { customer_id: customerId } : {}), status: 'unsubscribed', unsubscribed_at: now, unsubscribe_source: input.source, updated_at: now,
  }, { onConflict: 'email' });
  if (error) throw new Error(error.message);
  await logEvent(supabase, { email, action: 'unsubscribed', source: input.source });
  await syncCustomer(supabase, email, false);
}

/**
 * Save the three switches. All off = unsubscribe. Something on for an address that is not
 * subscribed is the person choosing to hear from us again (this only runs from the preferences page).
 */
export async function setTopics(supabase: SupabaseClient, input: { email: string; topics: unknown; source: 'preferences_page' | 'account' }): Promise<PreferenceRow | null> {
  const email = normaliseEmail(input.email);
  if (!email) throw new Error('Not an email address');
  const topics = normaliseTopics(input.topics, false);
  if (allTopicsOff(topics)) { await unsubscribe(supabase, { email, source: input.source }); return getPreferences(supabase, email); }
  const current = await getPreferences(supabase, email);
  if (!current || current.status !== 'subscribed') return subscribe(supabase, { email, source: input.source, topics, wording: pageWording(topics) });
  if (TOPIC_KEYS.every(k => current.topics[k] === topics[k])) return current;   // nothing changed
  const { data, error } = await supabase.from('email_preferences').update({ topics, updated_at: new Date().toISOString() }).eq('email', email).select('*').single();
  if (error) throw new Error(error.message);
  await logEvent(supabase, { email, action: 'topics_changed', source: input.source, topics });
  return asRow(data);
}

/**
 * A tick box (people who have not bought: e.g. quiz "save my Pawsonality") was submitted. Ticked → subscribe (basis 'consent'). NOT ticked → nothing at all: never unsubscribes,
 * never creates a row, never touches an existing one.
 */
export async function recordTick(supabase: SupabaseClient, input: { ticked: boolean; email: string | null | undefined; source: ConsentSource; customerId?: string | null; at?: string | null }): Promise<boolean> {
  if (!input.ticked || !input.email) return false;
  // A replayed tick (e.g. a retried webhook) must not undo an unsubscribe made after the box was ticked
  if (input.at && tickIsStale(await getPreferences(supabase, input.email), input.at)) return false;
  await subscribe(supabase, { email: input.email, source: input.source, customerId: input.customerId });
  return true;
}

export type PurchaseOutcome = 'subscribed' | 'already_subscribed' | 'left_unsubscribed' | 'declined';

/** Pure: what a paid order does to an address, given its row and whether the buyer ticked "No thanks" */
export function purchaseOutcome(row: Pick<PreferenceRow, 'status'> | null, optedOut: boolean): PurchaseOutcome {
  if (optedOut) return 'declined';
  if (row?.status === 'unsubscribed') return 'left_unsubscribed';   // never re-subscribe someone who unsubscribed
  if (row?.status === 'subscribed') return 'already_subscribed';
  return 'subscribed';
}

/**
 * A paid order (called from the Stripe webhook, never before payment). The buyer is subscribed
 * (basis 'soft_opt_in', all three topics) unless they ticked "No thanks, just my order emails".
 *   - never re-subscribes an unsubscribed address: only subscribe() from a deliberate tick, or the
 *     preferences page, can do that
 *   - ticking "No thanks" never unsubscribes anyone already subscribed; it only records an event ('declined')
 *   - already subscribed: nothing changes (their topics stay as they chose)
 */
export async function subscribeFromPurchase(supabase: SupabaseClient, input: { email: string | null | undefined; optedOut: boolean; customerId?: string | null }): Promise<PurchaseOutcome | null> {
  const email = normaliseEmail(input.email);
  if (!email) return null;
  const outcome = purchaseOutcome(await getPreferences(supabase, email), input.optedOut);
  if (outcome === 'declined') await logEvent(supabase, { email, action: 'declined', source: 'checkout', wording: CHECKOUT_WORDING });
  else if (outcome === 'subscribed') await subscribe(supabase, { email, source: 'checkout', customerId: input.customerId, basis: 'soft_opt_in', wording: CHECKOUT_WORDING });
  return outcome;
}

/**
 * For a future marketing send: the footer links and the one-click headers. Only for an address that
 * has a row (and so has said yes); returns null otherwise: rows are never created just to make a link.
 * Pass unsubscribe_url / preferences_url to the template, and headers as metadata.email_headers on
 * the queued message (the queue passes them to the email provider).
 */
export async function marketingEmailExtras(supabase: SupabaseClient, baseUrl: string, email: string): Promise<{ unsubscribe_url: string; preferences_url: string; headers: Record<string, string> } | null> {
  const row = await getPreferences(supabase, email);
  if (!row) return null;
  const unsub = unsubscribeUrl(baseUrl, row.id);
  return { unsubscribe_url: unsub, preferences_url: preferencesUrl(baseUrl, row.id), headers: listUnsubscribeHeaders(unsub) };
}
