/**
 * Picture address versions and the cache rule for catalogue pictures.
 * Client-safe: no imports, no Node APIs, so server and browser give the same answer (hydration).
 *
 * A catalogue picture is served at /api/secure-images/<id>?variant=mid_size&w=400&v=<version>.
 * `v` is only a cache key: the server ignores it when choosing the picture. It changes whenever
 * the design's picture changes (the design's public_url changes when a new picture, frame or
 * caption plate is applied), so an address can be cached for a year without ever going stale.
 */

/**
 * Mixed into every picture version. Bump it (e.g. '1' -> '2') after changing the watermark
 * (lib/watermark, CLOUDINARY_WATERMARK_* settings) or the variant definitions (lib/cloudinary.ts),
 * so every cached picture is requested again under a new address.
 */
export const PICTURE_CACHE_EPOCH = '1';

/** FNV-1a (32 bit) of a string, as base36 padded to 7 characters */
function fnv1a36(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36).padStart(7, '0');
}

/**
 * Short deterministic version for a picture, from anything that changes when the picture does
 * (the design's public_url, or an explicit version string). Empty or missing input gives
 * undefined, meaning "no version": the address then has no `v` and keeps its short cache.
 */
export function pictureVersion(source: string | number | null | undefined, epoch: string = PICTURE_CACHE_EPOCH): string | undefined {
  if (source === null || source === undefined) return undefined;
  const s = String(source).trim();
  if (!s) return undefined;
  return fnv1a36(`${epoch}|${s}`);
}

/** What the route accepts as a version: short and URL-safe. Anything else counts as "no version". */
export function cleanPictureVersion(v: string | null | undefined): string | undefined {
  return v && /^[A-Za-z0-9_-]{1,32}$/.test(v) ? v : undefined;
}

export const CACHE_PICTURE_FOREVER = 'public, max-age=31536000, s-maxage=31536000, immutable';
export const CACHE_PICTURE_SHORT = 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400';
export const CACHE_PICTURE_PRIVATE = 'private, max-age=300';

/**
 * Cache-Control for a picture response.
 * - not a public catalogue variant (customer images, purchased variants): private, 5 minutes
 * - public catalogue variant with a version, served from a generated variant: one year, immutable
 * - public catalogue variant without a version, or served from the stored legacy URL: an hour (as before)
 * The route's error-recovery fallback response does not use this: it is always private, 5 minutes.
 */
export function pictureCacheControl(o: { isPublicCatalogue: boolean; hasVersion: boolean; isFallback: boolean }): string {
  if (!o.isPublicCatalogue) return CACHE_PICTURE_PRIVATE;
  return o.hasVersion && !o.isFallback ? CACHE_PICTURE_FOREVER : CACHE_PICTURE_SHORT;
}
