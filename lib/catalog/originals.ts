/**
 * Uploads (original designs) vs generated versions of them, as Supabase filters (client-safe).
 * A version is a picture made from another design: a breed / coat / outfit / format variation,
 * a team version or a quiz picture. Linked versions have variation_of (since 17 Oct); older ones
 * are recognised by their tags and Cloudinary folders.
 * Used by Admin → Catalogue ("Uploads only" / "Variations only") and the variation batch picker.
 */
export const VERSION_TAG_LIST = ['variation', 'team-variant', 'batch-generated', 'quiz-generated'];
const VERSION_TAGS = `{${VERSION_TAG_LIST.join(',')}}`;
export const VERSION_FOLDERS = ['pawtraits/variations/', 'pawtraits/team-versions/', 'pawtraits/variation-previews/'];

/** Only original designs (uploads and pictures generated from a prompt, not from another design) */
export function onlyOriginals<Q extends { is: any; or: any }>(query: Q): Q {
  return query.is('variation_of', null)
    .or(`tags.is.null,tags.not.ov.${VERSION_TAGS}`)
    .or(`cloudinary_public_id.is.null,and(${VERSION_FOLDERS.map(f => `cloudinary_public_id.not.like.${f}*`).join(',')})`);
}

/** Only versions made from another design */
export function onlyVersions<Q extends { or: any }>(query: Q): Q {
  return query.or(['variation_of.not.is.null', `tags.ov.${VERSION_TAGS}`, ...VERSION_FOLDERS.map(f => `cloudinary_public_id.like.${f}*`)].join(','));
}

/** The same rule as onlyVersions, for one row in memory: linked, or recognised by its tags or Cloudinary folder */
export function looksLikeVersion(row: { variation_of?: string | null; tags?: string[] | null; cloudinary_public_id?: string | null }): boolean {
  return !!row.variation_of
    || (row.tags ?? []).some(t => VERSION_TAG_LIST.includes(t))
    || VERSION_FOLDERS.some(f => (row.cloudinary_public_id ?? '').startsWith(f));
}

/** The same rule as onlyOriginals(), for a row already loaded (needs variation_of, tags and cloudinary_public_id) */
export function isOriginalRow(row: { variation_of?: string | null; tags?: string[] | null; cloudinary_public_id?: string | null }): boolean {
  return !looksLikeVersion(row);
}
