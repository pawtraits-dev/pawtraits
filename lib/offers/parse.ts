/** Offers: small pure helpers for the admin pages */
const UUID_G = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

/** Catalogue design ids found in pasted text (ids or links such as /customise/<id>), lower-cased, no repeats */
export function parseDesignIds(text: unknown): string[] {
  return Array.from(new Set((String(text ?? '').match(UUID_G) ?? []).map(s => s.toLowerCase())));
}
