/**
 * Customer referral: wording, link building and name tidying. Pure and client-safe (no database,
 * no Node-only imports), so the share card, the landing banner, the emails and the tests all use
 * the same words and the same links.
 *
 * The share link is the one the /referrals page has always shared: <site>/c/<CODE>.
 * Optional ?d=<design id> opens that design's customise page for the friend.
 */

import { DEFAULT_REFERRAL_RATES, formatPct, type ReferralRates } from '@/lib/referrals/rates';

export const SITE_URL = 'https://pawtraits.pics';

/** Wording that does not state a percentage */
export const REFERRAL_COPY = {
  shareButton: 'Share with a friend',
  copyButton: 'Copy link',
  copiedButton: 'Copied',
  whatsapp: 'Share on WhatsApp',
  creditLink: 'See my credit',
  qrCaption: 'Or show a friend this code',
  emailButton: 'Share my link',
  emailKeepGoing: 'Keep it going',
  bannerGuestSub: 'Create an account to claim it. It comes off at checkout.',
  bannerSub: 'It comes off at checkout. Pick a design and add your pet\'s photo.',
} as const;

/**
 * Wording that states the percentages. They are admin settings (Customer Referrals), so every caller passes the rates:
 * server code from referralRates() (lib/app-settings.ts), client code from useReferralRates(). Omitted = the defaults, 10 and 10.
 */
export function referralCopy(rates: ReferralRates = DEFAULT_REFERRAL_RATES) {
  const f = formatPct(rates.friendPct);
  const r = formatPct(rates.referrerPct);
  return {
    heading: `Give ${f}, get ${r}`,
    line: `Your friend gets ${f} off their first Pawtrait. You get ${r} of their first order as credit.`,
    emailLine: `Know someone whose pet deserves a Pawtrait? Send them your link: they get ${f} off their first, you get ${r} of that order as credit.`,
    slipLine: `Show a friend this code. They get ${f} off their first Pawtrait, you get ${r} of that order as credit.`,
  };
}

const NAME_WORD = /^[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ'’-]{0,19}$/;
const titleCase = (w: string) => w.charAt(0).toLocaleUpperCase('en-GB') + w.slice(1).toLocaleLowerCase('en-GB');

/** "sarah jones" → "Sarah"; anything with digits, symbols or an email shape → null (first name only, letters only) */
export function safeFirstName(raw: string | null | undefined): string | null {
  const first = (raw ?? '').trim().split(/\s+/)[0]?.replace(/[.,!?]+$/, '') ?? '';
  return first && NAME_WORD.test(first) ? titleCase(first) : null;
}

/** A pet's name for the share text: letters only, or null for placeholders ("Uploaded Pet", "Pet") */
export function sharePetName(raw: string | null | undefined): string | null {
  const s = (raw ?? '').trim();
  if (!s || /^(uploaded pet|pet|my pet|unknown|dog|cat)$/i.test(s)) return null;
  const first = s.split(/\s+/)[0].replace(/[.,!?]+$/, '');
  return NAME_WORD.test(first) ? titleCase(first) : null;
}

/** Codes are upper case letters and digits, 4 to 24 long (what uniqueReferralCode makes) */
export const normaliseCode = (raw: unknown): string | null => {
  const c = typeof raw === 'string' ? raw.trim().toUpperCase() : '';
  return /^[A-Z0-9]{4,24}$/.test(c) ? c : null;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID_RE.test(v);

const root = (baseUrl?: string | null) => (baseUrl || SITE_URL).replace(/\/+$/, '');

/** The link a friend opens: /c/<CODE>, with ?d=<design> when a design is known */
export function buildShareUrl(baseUrl: string | null | undefined, code: string, designId?: string | null): string {
  const url = `${root(baseUrl)}/c/${encodeURIComponent(code.toUpperCase())}`;
  return isUuid(designId) ? `${url}?d=${designId}` : url;
}

/** "pawtraits.pics/c/ABCD1234" for text and print */
export function shortLink(baseUrl: string | null | undefined, code: string): string {
  return `${root(baseUrl).replace(/^https?:\/\//, '')}/c/${encodeURIComponent(code.toUpperCase())}`;
}

/** The public page where an owner (not signed in) gets their link, QR and share button: used by email buttons */
export const sharePageUrl = (baseUrl: string | null | undefined, code: string) => `${root(baseUrl)}/share/referral/${encodeURIComponent(code.toUpperCase())}`;

/** What goes with the link. "{Pet} painted by Pawcasso" when a pet name is known */
export function shareText(petName?: string | null, rates: ReferralRates = DEFAULT_REFERRAL_RATES): string {
  const pet = sharePetName(petName);
  const off = formatPct(rates.friendPct);
  return pet
    ? `I had ${pet} painted by Pawcasso at Pawtraits. Here's ${off} off your first one:`
    : `I had my pet painted by Pawcasso at Pawtraits. Here's ${off} off your first one:`;
}

/** Text and link together, for WhatsApp and copy-and-paste */
export const shareMessage = (url: string, petName?: string | null, rates: ReferralRates = DEFAULT_REFERRAL_RATES) => `${shareText(petName, rates)} ${url}`;

export const whatsappUrl = (url: string, petName?: string | null, rates: ReferralRates = DEFAULT_REFERRAL_RATES) => `https://wa.me/?text=${encodeURIComponent(shareMessage(url, petName, rates))}`;

/** The friend's banner: "Sarah gave you 10% off your first Pawtrait", or "A friend ..." with no usable name */
export function bannerText(firstName?: string | null, rates: ReferralRates = DEFAULT_REFERRAL_RATES, signedIn = true): { headline: string; sub: string } {
  const name = safeFirstName(firstName);
  return { headline: `${name ?? 'A friend'} gave you ${formatPct(rates.friendPct)} off your first Pawtrait`, sub: signedIn ? REFERRAL_COPY.bannerSub : REFERRAL_COPY.bannerGuestSub };
}

/** localStorage key the checkout already reads. Do not rename. */
export const REFERRAL_STORAGE_KEY = 'referralCode';
export const BANNER_DISMISSED_KEY = 'pt_ref_banner_dismissed';
