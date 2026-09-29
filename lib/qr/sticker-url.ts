/**
 * Sticker QR short links.
 *
 *   /S/1123            image 1123, no size, no location
 *   /S/1123M           image 1123, size M
 *   /S/1123M/CAMDEN    image 1123, size M, credited to location CAMDEN
 *
 * URLs are generated in UPPER CASE so the QR uses alphanumeric mode (smaller,
 * easier-to-scan code). Parsing is case-insensitive. Middleware rewrites /S/* to /s/*.
 * Spec: docs/specs/qr-stickers.md
 */

export type StickerSize = 'S' | 'M' | 'L';

export const STICKER_SIZES: StickerSize[] = ['S', 'M', 'L'];
export const LOCATION_CODE_PATTERN = /^[A-Z0-9]{2,8}$/;

export interface StickerTarget {
  stockRef: number;
  size?: StickerSize | null;
  locationCode?: string | null;
}

const DEFAULT_BASE = 'https://pawtraits.pics';

export function getShortLinkBase(): string {
  const base = process.env.NEXT_PUBLIC_SHORT_LINK_BASE || DEFAULT_BASE;
  return base.replace(/\/+$/, '');
}

/** Normalise a free-text location code; returns null if invalid/empty. */
export function normaliseLocationCode(code?: string | null): string | null {
  if (!code) return null;
  const c = code.trim().toUpperCase();
  return LOCATION_CODE_PATTERN.test(c) ? c : null;
}

/** Path part only, e.g. "/S/1123M/CAMDEN". */
export function buildStickerPath({ stockRef, size, locationCode }: StickerTarget): string {
  if (!Number.isInteger(stockRef) || stockRef <= 0) {
    throw new Error(`Invalid stock ref: ${stockRef}`);
  }
  if (size && !STICKER_SIZES.includes(size)) {
    throw new Error(`Invalid size: ${size}`);
  }
  const loc = locationCode ? normaliseLocationCode(locationCode) : null;
  if (locationCode && !loc) {
    throw new Error(`Invalid location code: ${locationCode}`);
  }
  return `/S/${stockRef}${size ?? ''}${loc ? `/${loc}` : ''}`;
}

/** Full URL in upper case, ready to encode in a QR. */
export function buildStickerUrl(target: StickerTarget, base: string = getShortLinkBase()): string {
  return `${base}${buildStickerPath(target)}`.toUpperCase();
}

export interface ParsedSticker {
  stockRef: number;
  size: StickerSize | null;
  /** Raw (upper-cased) location code as scanned; may not exist in DB. */
  locationCode: string | null;
}

/**
 * Parse the segments after /s/. Accepts ["1123M", "CAMDEN"] and the legacy
 * ?l=CAMDEN form via `legacyLocation`. Returns null if the ref is unusable.
 */
export function parseStickerSegments(
  segments: string[],
  legacyLocation?: string | null
): ParsedSticker | null {
  if (!segments.length || segments.length > 2) return null;

  const m = /^(\d{1,9})([SML])?$/i.exec(segments[0].trim());
  if (!m) return null;

  const stockRef = parseInt(m[1], 10);
  if (!Number.isSafeInteger(stockRef) || stockRef <= 0) return null;

  const size = (m[2]?.toUpperCase() as StickerSize | undefined) ?? null;

  const rawLoc = segments[1] ?? legacyLocation ?? null;
  // Keep any plausible code (even if not in DB) so mistyped/retired codes are visible
  // in reports; reject anything that isn't short alphanumeric.
  const locationCode = rawLoc ? normaliseLocationCode(decodeURIComponent(rawLoc)) : null;

  return { stockRef, size, locationCode };
}
