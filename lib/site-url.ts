/**
 * The address that goes into links we email (signed preview and offer links).
 *
 * On the live site: NEXT_PUBLIC_BASE_URL (https://www.pawtraits.pics). On a Vercel preview deployment the
 * link must come back to THAT deployment: signed links are checked with the deployment's own secret, and a
 * preview site may hold a different one from the live site, so a link signed on a preview site and opened on
 * the live site is refused ("This link has gone walkies").
 */
const trim = (u: string) => u.replace(/\/$/, '');

/** Pure: which address to use, given the environment and (when there is one) the request's own origin */
export function pickLinkBaseUrl(env: { VERCEL_ENV?: string; VERCEL_URL?: string; NEXT_PUBLIC_BASE_URL?: string }, requestOrigin?: string | null): string {
  if (env.VERCEL_ENV === 'preview') {
    if (requestOrigin) return trim(requestOrigin);
    if (env.VERCEL_URL) return `https://${trim(env.VERCEL_URL)}`;
  }
  return trim(env.NEXT_PUBLIC_BASE_URL || requestOrigin || 'https://pawtraits.pics');
}

export const linkBaseUrl = (requestOrigin?: string | null) => pickLinkBaseUrl(process.env as any, requestOrigin);

/**
 * A same-site path that is safe to send someone to after sign-in or sign-up, or null.
 * Decodes once (a bad escape is refused) and refuses anything that could leave the site: not starting with a single "/",
 * "//" or "/\\" at the start, any backslash, any control character or whitespace (tabs and newlines are ignored by
 * browsers inside a URL), or "://". The raw text and its decoded form must both pass; the raw text is returned.
 */
export function safeReturnPath(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string' || !raw) return null;
  let decoded: string;
  try { decoded = decodeURIComponent(raw); } catch { return null; }
  for (const v of [raw, decoded]) {
    if (!v.startsWith('/') || v.startsWith('//') || v.startsWith('/\\')) return null;
    if (v.includes('\\') || v.includes('://')) return null;
    if (/[\u0000-\u0020\u007f-\u009f\s]/.test(v)) return null;
  }
  return raw;
}
