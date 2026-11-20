/**
 * Gelato webhook helpers (pure, no network). Kept out of the route file because a Next route file
 * may only export handlers.
 */
import { timingSafeEqual } from 'crypto';

/** True only when a secret is configured and the provided token equals it (constant-time, equal length). */
export function webhookTokenOk(provided: string | null | undefined, secret: string | null | undefined): boolean {
  if (!secret || typeof secret !== 'string') return false;
  if (!provided || typeof provided !== 'string') return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** A Gelato order id we are willing to look up: 1 to 100 characters of letters, digits, underscore or hyphen. */
export function validGelatoOrderId(id: unknown): id is string {
  return typeof id === 'string' && id.length > 0 && id.length <= 100 && /^[A-Za-z0-9_-]+$/.test(id);
}
