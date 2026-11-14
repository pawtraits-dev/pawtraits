/**
 * How the Browse page's URL turns into filters. One pure, client-safe module (no Next / Supabase imports)
 * used by BOTH the server page (app/browse/page.tsx, to load the first designs) and the client page
 * (app/browse/BrowseClient.tsx), so the two can never disagree about which designs a URL means.
 *
 *   URL  ?type=dogs|cats|themes &breed=<id> &theme=<id> &search=<text>
 *    -> BrowseUrlState { tab, breed, theme, search }
 *    -> grid key (a query string for GET /api/public/browse, without page / limit), '' when no grid is shown
 */

export type BrowseTab = 'all' | 'dogs' | 'cats' | 'themes';
export type ThemeAnimalFilter = 'all' | 'dogs' | 'cats';

export interface BrowseUrlState {
  tab: BrowseTab;
  /** '' when none */
  breed: string;
  /** '' when none */
  theme: string;
  /** raw text as typed ('' when none) */
  search: string;
}

export const BROWSE_PAGE_SIZE = 24;
/** The first row of pictures is loaded with high priority (first 2 cards on phones, 4 on desktop) */
export const BROWSE_PRIORITY_COUNT = 4;

type ParamValue = string | string[] | null | undefined;

function firstValue(v: ParamValue): string {
  const s = Array.isArray(v) ? v[0] : v;
  return typeof s === 'string' ? s : '';
}

/** From anything with .get(name) (URLSearchParams, ReadonlyURLSearchParams) */
export function browseStateFromGetter(get: (name: string) => string | null | undefined): BrowseUrlState {
  const type = get('type');
  const tab: BrowseTab = type === 'dogs' || type === 'cats' || type === 'themes' ? type : 'all';
  return {
    tab,
    breed: get('breed') || '',
    theme: get('theme') || '',
    search: get('search') || '',
  };
}

/** From the `searchParams` object a server page receives (first value wins, like URLSearchParams.get) */
export function browseStateFromRecord(sp: Record<string, ParamValue> | null | undefined): BrowseUrlState {
  const rec = sp || {};
  return browseStateFromGetter(name => firstValue(rec[name]) || null);
}

/** Is a grid of designs shown (as opposed to the breed / theme cards)? */
export function browseGridVisible(s: Pick<BrowseUrlState, 'tab' | 'breed' | 'theme'>): boolean {
  return !!s.breed || !!s.theme || s.tab === 'all';
}

/**
 * The query string (no page / limit) for the designs of this view; '' when no grid is shown or when the
 * view has no filters (All tab). Extra theme-only filters default to "none" (they are never in the URL).
 */
export function browseGridKey(
  s: BrowseUrlState,
  extra: { themeAnimal?: ThemeAnimalFilter; themeBreedSearch?: string } = {},
): string {
  if (!browseGridVisible(s)) return '';
  const themeAnimal = extra.themeAnimal ?? 'all';
  const themeBreedSearch = extra.themeBreedSearch ?? '';
  const p = new URLSearchParams();
  if (s.breed) p.set('breed', s.breed);
  if (s.theme) {
    p.set('theme', s.theme);
    if (themeAnimal !== 'all') p.set('animal', themeAnimal === 'dogs' ? 'dog' : 'cat');
    if (themeBreedSearch.trim()) p.set('breedName', themeBreedSearch.trim());
  } else if (!s.breed && (s.tab === 'dogs' || s.tab === 'cats')) {
    p.set('animal', s.tab === 'dogs' ? 'dog' : 'cat');
  }
  // The search box narrows designs only inside a breed
  if (s.breed && s.search.trim()) p.set('search', s.search.trim());
  return p.toString();
}

/** The URL the page shows for this state (same rule the client uses when it updates the address bar) */
export function browseUrlFor(s: BrowseUrlState): string {
  const p = new URLSearchParams();
  if (s.tab !== 'all') p.set('type', s.tab);
  if (s.search) p.set('search', s.search);
  if (s.breed) p.set('breed', s.breed);
  if (s.theme) p.set('theme', s.theme);
  const qs = p.toString();
  return `/browse${qs ? '?' + qs : ''}`;
}

/** The raw query values GET /api/public/browse understands, from a grid key */
export function browseApiParamsFromKey(key: string, page = 1, limit = BROWSE_PAGE_SIZE) {
  const qs = new URLSearchParams(key);
  return {
    page,
    limit,
    breed: qs.get('breed'),
    theme: qs.get('theme'),
    animal: qs.get('animal'),
    search: qs.get('search'),
    breedName: qs.get('breedName'),
  };
}
