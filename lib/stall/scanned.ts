/**
 * Which stall prints this shopper has scanned the sticker of. The stall price is offered only for those.
 * Held in the signed `pt_stall` cookie (a list, so several stickers can go in one basket for the multi-buy
 * saving). `pt_qr` still holds only the last scan, for sales attribution. Pure functions: no network.
 */
import { sign, verifySigned, type QrAttribution } from '@/lib/qr/attribution';

export const STALL_SCAN_COOKIE = 'pt_stall';
/** A stall "take it home now" offer is only shown to someone who scanned a located sticker recently. */
export const STALL_SCAN_FRESH_HOURS = 12;
export const STALL_SCAN_MAX_AGE_S = STALL_SCAN_FRESH_HOURS * 3600;
export const STALL_SCAN_MAX_ENTRIES = 24;

export interface StallScan {
  imageId: string;
  /** Sticker size; null for a sticker with no size (it then stands for any size of that image) */
  size: string | null;
  locationId: string;
  ts: number; // ms epoch
}

const isFresh = (e: StallScan, now: number) => now - e.ts <= STALL_SCAN_FRESH_HOURS * 3600_000 && e.ts <= now + 60_000;
const sameKey = (a: StallScan, b: StallScan) => a.imageId === b.imageId && (a.size ?? null) === (b.size ?? null);

/** Adds a scan: drops stale entries, replaces the same image and size, newest first, at most 24. */
export function addStallScan(list: StallScan[], entry: StallScan, now: number): StallScan[] {
  const kept = list.filter(e => isFresh(e, now) && !sameKey(e, entry));
  return [entry, ...kept].sort((a, b) => b.ts - a.ts).slice(0, STALL_SCAN_MAX_ENTRIES);
}

/** The freshest fresh entry for the image. With a size: that size (a sizeless sticker matches any); without: any. */
export function findStallScan(list: StallScan[], imageId: string, size: string | null, now: number): StallScan | null {
  const want = size ? size.toUpperCase() : null;
  const hits = list.filter(e => e.imageId === imageId && isFresh(e, now) && (!want || e.size === null || e.size === want));
  if (!hits.length) return null;
  return hits.sort((a, b) => (b.ts - a.ts) || (Number(b.size === want) - Number(a.size === want)))[0];
}

export function encodeStallScans(list: StallScan[]): string {
  const payload = Buffer.from(JSON.stringify(list)).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

function validEntry(e: any): e is StallScan {
  return !!e && typeof e.imageId === 'string' && !!e.imageId && typeof e.locationId === 'string' && !!e.locationId
    && typeof e.ts === 'number' && Number.isFinite(e.ts) && (e.size === null || typeof e.size === 'string');
}

/** Tampered, malformed or expired data gives an empty list. */
export function decodeStallScans(value: string | null | undefined, now: number = Date.now()): StallScan[] {
  const payload = verifySigned(value);
  if (!payload) return [];
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!Array.isArray(data)) return [];
    return data.filter(validEntry).filter(e => isFresh(e, now)).slice(0, STALL_SCAN_MAX_ENTRIES);
  } catch {
    return [];
  }
}

/**
 * The scan that lets this image (and, for a basket line, this size) be bought at the stall price, or null.
 * Transition fallback: with no `pt_stall` cookie at all (a shopper mid-visit when this shipped), the last
 * located scan in `pt_qr` counts, but only for the very image (and size) it scanned.
 * Browsing (not strict) with a size that was not scanned falls back to that image's scanned size.
 */
export function resolveScannedEntry(opts: {
  cookieValue: string | null | undefined;
  attr: QrAttribution | null;
  imageId: string;
  requestedSize: string | null | undefined;
  strict: boolean;
  now: number;
}): StallScan | null {
  const { cookieValue, attr, imageId, requestedSize, strict, now } = opts;
  let list: StallScan[];
  if (cookieValue) list = decodeStallScans(cookieValue, now);
  else if (attr?.locationId && attr.imageId === imageId) list = [{ imageId, size: attr.size ?? null, locationId: attr.locationId, ts: attr.ts }];
  else list = [];
  const want = requestedSize ? requestedSize.toUpperCase() : null;
  const exact = findStallScan(list, imageId, want, now);
  if (exact || strict) return exact;
  return findStallScan(list, imageId, null, now);
}
