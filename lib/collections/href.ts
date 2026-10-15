/**
 * Where a collection lives (client-safe). The Pawsonalities collection is the /pawsonalities
 * pages, not a /collections page: one place for the 16 types.
 */
export function collectionHref(path: string): string {
  if (path === 'pawsonalities') return '/pawsonalities';
  const m = path.match(/^pawsonalities\/([a-z]{4})$/i);
  if (m) return `/pawsonalities/dog/${m[1].toLowerCase()}`; // redirects to the type's named page
  return `/collections/${path}`;
}
