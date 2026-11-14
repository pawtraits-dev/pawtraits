/**
 * Customer referral: wording, link building and name tidying. Pure and client-safe (no database,
 * no Node-only imports), so the share card, the landing banner, the emails and the tests all use
 * the same words and the same links.
 *
 * The share link is the one the /referrals page has always shared: <site>/c/<CODE>.
 * Optional ?d=<design id> opens that design's customise page for the friend.
 */

export const SITE_URL = 'https://pawtraits.pics';

export const REFERRAL_COPY = {
  heading: 'Give 10%, get 10%',
  line: 'Your friend gets 10% off their first Pawtrait. You get 10% of their order as credit.',
  shareButton: 'Share with a friend',
  copyButton: 'Copy link',
  copiedButton: 'Copied',
  whatsapp: 'Share on WhatsApp',
  creditLink: 'See my credit',
  qrCaption: 'Or show a friend this code',
  emailLine: 'Know someone whose pet deserves a Pawtrait? Send them your link: they get 10% off their first, you get 10% of their order as credit.',
  emailButton: 'Share my link',
  emailKeepGoing: 'Keep it going',
  slipLine: 'Show a friend this code. They get 10% off their first Pawtrait, you get 10% of their order as credit.',
  bannerSub: 'It comes off at checkout. Pick a design and add your pet\'s photo.',
} as const;

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
export function shareText(petName?: string | null): string {
  const pet = sharePetName(petName);
  return pet
    ? `I had ${pet} painted by Pawcasso at Pawtraits. Here's 10% off your first one:`
    : 'I had my pet painted by Pawcasso at Pawtraits. Here\'s 10% off your first one:';
}

/** Text and link together, for WhatsApp and copy-and-paste */
export const shareMessage = (url: string, petName?: string | null) => `${shareText(petName)} ${url}`;

export const whatsappUrl = (url: string, petName?: string | null) => `https://wa.me/?text=${encodeURIComponent(shareMessage(url, petName))}`;

/** The friend's banner: "Sarah gave you 10% off your first Pawtrait", or "A friend ..." with no usable name */
export function bannerText(firstName?: string | null): { headline: string; sub: string } {
  const name = safeFirstName(firstName);
  return { headline: `${name ?? 'A friend'} gave you 10% off your first Pawtrait`, sub: REFERRAL_COPY.bannerSub };
}

/** localStorage key the checkout already reads. Do not rename. */
export const REFERRAL_STORAGE_KEY = 'referralCode';
export const BANNER_DISMISSED_KEY = 'pt_ref_banner_dismissed';
