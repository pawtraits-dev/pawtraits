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
