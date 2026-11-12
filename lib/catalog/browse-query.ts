/**
 * Pure helpers for GET /api/public/browse (no Next / Supabase imports, so scripts can test them).
 */

export const BROWSE_DEFAULT_LIMIT = 24;
export const BROWSE_MAX_LIMIT = 48;
export const BROWSE_MAX_PAGE = 10000;
export const BROWSE_MAX_SEARCH_LENGTH = 50;

/** Same select as SupabaseService.getImages (public listing): the row plus its look-up names */
export const BROWSE_SELECT = `
        *,
        breeds(name, slug, animal_type),
        themes(name),
        styles(name),
        formats(name),
        coats(name, hex_color, animal_type)
      `;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(v: unknown): v is string {
  return typeof v === 'string' && UUID_RE.test(v);
}

function toInt(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).trim());
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

/** 1..BROWSE_MAX_PAGE, default 1 */
export function clampPage(v: unknown): number {
  const n = toInt(v);
  if (n === null || n < 1) return 1;
  return Math.min(n, BROWSE_MAX_PAGE);
}

/** 1..48, default 24 */
export function clampLimit(v: unknown): number {
  const n = toInt(v);
  if (n === null) return BROWSE_DEFAULT_LIMIT;
  return Math.min(Math.max(n, 1), BROWSE_MAX_LIMIT);
}

/**
 * Makes free text safe to drop into a PostgREST `.or()` string and an ilike pattern.
 * Keeps letters (incl. accented/non-Latin), digits, spaces, hyphens and apostrophes; everything else
 * (commas, parentheses, quotes, braces, % _ * \ . : etc.) becomes a space. Lower-cased,
 * whitespace collapsed, capped at 50 characters. Returns '' when nothing usable is left.
 */
export function sanitiseSearch(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const cleaned = raw
    .toLowerCase()
    .replace(/[^a-zA-Z0-9\s'\-\u00C0-\uFFFF]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, BROWSE_MAX_SEARCH_LENGTH)
    .trim();
  return cleaned;
}

export type BrowseAnimal = 'dog' | 'cat';

export function parseAnimal(v: unknown): BrowseAnimal | null {
  return v === 'dog' || v === 'cat' ? v : null;
}

/**
 * PostgREST `or` filter for the old client rule matchesAnimalType():
 *   cat: breed is a cat breed, or tags contain 'cat'
 *   dog: breed is a dog breed, or tags contain 'dog', or (no breed and tags do not contain 'cat')
 * breeds.animal_type is NOT NULL and only 'dog'|'cat', so "dog breed" = has a breed that is not a cat breed.
 */
export function animalOrFilter(animal: BrowseAnimal, catBreedIds: string[]): string {
  const cats = catBreedIds.filter(isUuid);
  if (animal === 'cat') {
    return cats.length ? `breed_id.in.(${cats.join(',')}),tags.cs.{cat}` : 'tags.cs.{cat}';
  }
  const dogBreed = cats.length
    ? `and(breed_id.not.is.null,breed_id.not.in.(${cats.join(',')}))`
    : 'breed_id.not.is.null';
  return `${dogBreed},tags.cs.{dog},and(breed_id.is.null,or(tags.is.null,tags.not.cs.{cat}))`;
}

/** Selected breed: primary breed, or any pet in generation_parameters.subjects (as the old client rule) */
export function breedOrFilter(breedId: string): string | null {
  if (!isUuid(breedId)) return null;
  return `breed_id.eq.${breedId},generation_parameters.cs.{"subjects":[{"breedId":"${breedId}"}]}`;
}

/** Free-text search: description, tags (exact tag), and primary breed name (via matching breed ids) */
export function searchOrFilter(term: string, matchingBreedIds: string[]): string | null {
  const t = sanitiseSearch(term);
  if (!t) return null;
  const parts = [`description.ilike.%${t}%`, `tags.cs.{"${t}"}`];
  const ids = matchingBreedIds.filter(isUuid);
  if (ids.length) parts.push(`breed_id.in.(${ids.join(',')})`);
  return parts.join(',');
}

/** Same row shape SupabaseService.getImages returns */
export function shapeBrowseRow(item: any) {
  return {
    ...item,
    breed_name: item.breeds?.name,
    breed_animal_type: item.breeds?.animal_type,
    theme_name: item.themes?.name,
    style_name: item.styles?.name,
    format_name: item.formats?.name,
    coat_name: item.coats?.name,
    coat_hex_color: item.coats?.hex_color,
    coat_animal_type: item.coats?.animal_type,
    coat_id: item.coat_id,
    breed: item.breeds ? { id: item.breed_id, name: item.breeds.name, slug: item.breeds.slug || '', animal_type: item.breeds.animal_type } : undefined,
    theme: item.themes ? { id: item.theme_id, name: item.themes.name } : undefined,
    style: item.styles ? { id: item.style_id, name: item.styles.name } : undefined,
    coat: item.coats ? { id: item.coat_id, name: item.coats.name, hex_color: item.coats.hex_color, animal_type: item.coats.animal_type } : undefined,
  };
}

export interface BrowseFacets {
  byBreed: Record<string, number>;
  byTheme: Record<string, number>;
  /** per theme: designs with a dog breed / a cat breed (primary or any pet) */
  themeAnimal: Record<string, { dogs: number; cats: number }>;
  /** per breed (primary or any pet): distinct format ids of its designs, for "from £X" prices */
  breedFormats: Record<string, string[]>;
}

/** Builds the facets from slim rows (breed_id, theme_id, format_id, subjects JSON) */
export function buildFacets(
  rows: Array<{ breed_id?: string | null; theme_id?: string | null; format_id?: string | null; subjects?: any }>,
  breedTypes: Record<string, string>,
): BrowseFacets {
  const byBreed: Record<string, number> = {};
  const byTheme: Record<string, number> = {};
  const themeAnimal: Record<string, { dogs: number; cats: number }> = {};
  const formats: Record<string, Set<string>> = {};

  for (const r of rows) {
    const breeds = new Set<string>();
    if (r.breed_id) breeds.add(r.breed_id);
    if (Array.isArray(r.subjects)) {
      for (const s of r.subjects) if (s && typeof s.breedId === 'string' && s.breedId) breeds.add(s.breedId);
    }
    let dog = false;
    let cat = false;
    for (const b of Array.from(breeds)) {
      byBreed[b] = (byBreed[b] || 0) + 1;
      if (r.format_id) (formats[b] ||= new Set()).add(r.format_id);
      if (breedTypes[b] === 'dog') dog = true;
      if (breedTypes[b] === 'cat') cat = true;
    }
    if (r.theme_id) {
      byTheme[r.theme_id] = (byTheme[r.theme_id] || 0) + 1;
      const t = (themeAnimal[r.theme_id] ||= { dogs: 0, cats: 0 });
      if (dog) t.dogs += 1;
      if (cat) t.cats += 1;
    }
  }

  const breedFormats: Record<string, string[]> = {};
  for (const [b, set] of Object.entries(formats)) breedFormats[b] = Array.from(set);
  return { byBreed, byTheme, themeAnimal, breedFormats };
}
