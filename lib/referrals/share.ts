/**
 * A customer's referral details, in one place (server only): their EXISTING personal code, the
 * EXISTING friend landing link (<site>/c/<CODE>, the one /referrals shares), a print-safe QR and a
 * first name that is safe to show.
 *
 * A code is only returned for a registered customer, because the landing page and its checks only
 * honour codes of registered customers. When `create` is on and a registered customer has no code
 * yet (older accounts), one is made with the same function guest accounts use. Anyone else gets null,
 * and every caller then simply leaves the referral block out.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { canEmail, marketingEmailExtras, normaliseEmail } from '@/lib/marketing/preferences';
import { renderQrSvg } from '@/lib/qr/render';
import { uniqueReferralCode } from '@/lib/referrals/code';
import { buildShareUrl, normaliseCode, safeFirstName, shortLink, sharePageUrl } from '@/lib/referrals/text';

export interface ReferralDetails {
  customerId: string;
  code: string;
  /** https://pawtraits.pics/c/CODE (friend landing) */
  shareUrl: string;
  /** pawtraits.pics/c/CODE, for text and print */
  shortLink: string;
  /** Public page where the owner gets the share button, QR and link without signing in (email buttons) */
  sharePageUrl: string;
  /** First name only, letters only; null when there is no usable one */
  firstName: string | null;
  /** Print-safe QR of shareUrl (black on white, quiet zone included), when asked for */
  qrSvg?: string;
}

export interface DetailsOptions {
  baseUrl?: string;
  /** Make a code for a registered customer who has none (writes). Off for read-only callers like print. */
  create?: boolean;
  qr?: boolean;
}

export const siteBaseUrl = () => process.env.NEXT_PUBLIC_BASE_URL || 'https://pawtraits.pics';
const likeEscape = (s: string) => s.replace(/[\\%_]/g, c => `\\${c}`);
const COLUMNS = 'id, first_name, email, personal_referral_code, is_registered';

async function finish(supabase: SupabaseClient, row: any, opts: DetailsOptions): Promise<ReferralDetails | null> {
  if (!row || !row.is_registered) return null;
  let code: string | null = normaliseCode(row.personal_referral_code);
  if (!code && opts.create) {
    const made = await uniqueReferralCode(supabase, safeFirstName(row.first_name) || 'CUST');
    if (made) {
      // Only fills an empty slot, so two callers at once cannot overwrite each other
      await supabase.from('customers').update({ personal_referral_code: made }).eq('id', row.id).is('personal_referral_code', null);
      const { data } = await supabase.from('customers').select('personal_referral_code').eq('id', row.id).maybeSingle();
      code = normaliseCode((data as any)?.personal_referral_code);
    }
  }
  if (!code) return null;
  const baseUrl = opts.baseUrl || siteBaseUrl();
  const shareUrl = buildShareUrl(baseUrl, code);
  return {
    customerId: row.id,
    code,
    shareUrl,
    shortLink: shortLink(baseUrl, code),
    sharePageUrl: sharePageUrl(baseUrl, code),
    firstName: safeFirstName(row.first_name),
    ...(opts.qr ? { qrSvg: await renderQrSvg(shareUrl) } : {}),
  };
}

export async function getReferralDetails(supabase: SupabaseClient, email: string | null | undefined, opts: DetailsOptions = {}): Promise<ReferralDetails | null> {
  try {
    const e = normaliseEmail(email);
    if (!e) return null;
    const { data } = await supabase.from('customers').select(COLUMNS).ilike('email', likeEscape(e)).limit(1).maybeSingle();
    return await finish(supabase, data, opts);
  } catch (err) {
    console.warn('Referral details unavailable', err);
    return null;
  }
}

export async function getReferralDetailsByCode(supabase: SupabaseClient, rawCode: unknown, opts: DetailsOptions = {}): Promise<ReferralDetails | null> {
  try {
    const code = normaliseCode(rawCode);
    if (!code) return null;
    const { data } = await supabase.from('customers').select(COLUMNS).eq('personal_referral_code', code).maybeSingle();
    return await finish(supabase, data, opts);
  } catch (err) {
    console.warn('Referral details unavailable', err);
    return null;
  }
}

/** Details for many emails at once, read-only (packing slips). Keyed by lower-case email. */
export async function getReferralDetailsForEmails(supabase: SupabaseClient, emails: (string | null | undefined)[], opts: DetailsOptions = {}): Promise<Map<string, ReferralDetails>> {
  const out = new Map<string, ReferralDetails>();
  const list = Array.from(new Set(emails.map(normaliseEmail).filter((e): e is string => !!e)));
  if (!list.length) return out;
  try {
    const { data } = await supabase.from('customers').select(COLUMNS).in('email', list);
    for (const row of data ?? []) {
      const d = await finish(supabase, row, { ...opts, create: false });
      if (d && row.email) out.set(String(row.email).toLowerCase(), d);
    }
  } catch (err) {
    console.warn('Referral details unavailable', err);
  }
  return out;
}

/**
 * Template variables for the referral block in a customer email: the code, link and button, plus the
 * unsubscribe footer and List-Unsubscribe headers (the block is marketing content).
 *
 * Returns null, and so adds nothing, unless the customer has details AND canEmail(email, 'offers') is
 * true at this moment. If email_preferences does not exist yet, canEmail fails closed.
 * Never throws.
 */
export interface ReferralEmailVars {
  vars: Record<string, string>;
  /** Pass as sendMessage's `metadata` (carries the List-Unsubscribe headers) */
  metadata: Record<string, any>;
}

export async function referralEmailVars(supabase: SupabaseClient, email: string | null | undefined, baseUrl: string = siteBaseUrl()): Promise<ReferralEmailVars | null> {
  try {
    const e = normaliseEmail(email);
    if (!e) return null;
    if (!(await canEmail(supabase, e, 'offers'))) return null;
    const details = await getReferralDetails(supabase, e, { baseUrl, create: true });
    if (!details) return null;
    const extras = await marketingEmailExtras(supabase, baseUrl, e);
    return {
      vars: {
        share_code: details.code,
        share_url: details.sharePageUrl,
        share_link: details.shareUrl,
        share_short: details.shortLink,
        ...(extras ? { unsubscribe_url: extras.unsubscribe_url, preferences_url: extras.preferences_url } : {}),
      },
      metadata: extras ? { email_headers: extras.headers } : {},
    };
  } catch (err) {
    console.warn('Referral block left out', err);
    return null;
  }
}
