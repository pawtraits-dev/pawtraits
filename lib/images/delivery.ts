/**
 * Faster delivery for banner/hero images stored as raw URLs (carousels, theme and breed heroes).
 *
 * - Cloudinary upload URLs get f_auto,q_auto and a width cap added.
 * - Other URLs (e.g. Supabase Storage PNGs) are served through Cloudinary "fetch" when
 *   CLOUDINARY_FETCH_REMOTE=true. Fetched URLs must be allowed in Cloudinary
 *   (Settings → Security → Restricted media types: untick "Fetched URL"); leave the flag
 *   off until then and the original URL is used.
 *
 * Server-side only (reads env); no secrets are put in the URL.
 */
const CLOUD = process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;

export function optimisedImageUrl(url: string | null | undefined, width = 1600): string | null | undefined {
  if (!url || typeof url !== 'string' || !/^https?:\/\//.test(url)) return url;
  const t = `f_auto,q_auto,c_limit,w_${width}`;

  const m = url.match(/^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.*)$/);
  if (m) {
    if (/(^|[,/])f_auto/.test(m[2])) return url; // already optimised
    return `${m[1]}${t}/${m[2]}`;
  }

  if (process.env.CLOUDINARY_FETCH_REMOTE === 'true' && CLOUD && !url.includes('res.cloudinary.com')) {
    return `https://res.cloudinary.com/${CLOUD}/image/fetch/${t}/${encodeURIComponent(url)}`;
  }
  return url;
}

/** Apply optimisedImageUrl to the named fields of each row */
export function withOptimisedImages<T extends Record<string, any>>(rows: T[], fields: string[], width = 1600): T[] {
  return (rows || []).map(r => {
    const out: Record<string, any> = { ...r };
    for (const f of fields) if (f in out) out[f] = optimisedImageUrl(out[f], width);
    return out as T;
  });
}
