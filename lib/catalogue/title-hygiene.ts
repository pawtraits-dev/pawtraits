/**
 * Catalogue title hygiene (review item U5). Pure functions, no I/O.
 *
 * A design's title is the first line of image_catalog.description (stored as "**Title**" followed by
 * the body text), so cleanDescriptionTitle() applies cleanTitle() to that first line only.
 */

const LEAD = /^[\s#*_>\-`"'“”‘’]+/;
const TRAIL = /[\s*_`"“”]+$/;
const TRAIL_APOS = /[\s'’]+$/;

/** Trim, strip leading markdown markers / surrounding bold and quotes, collapse whitespace, drop a trailing full stop */
export function cleanTitle(raw: string): string {
  let s = String(raw ?? '').trim();
  const lead = s.match(LEAD)?.[0] ?? '';
  const hadQuote = /["'“”‘’]/.test(lead);
  s = s.replace(LEAD, '');
  s = s.replace(/\s+/g, ' ');
  for (let i = 0; i < 4; i++) {
    const before = s;
    s = s.replace(TRAIL, '');
    if (hadQuote) s = s.replace(TRAIL_APOS, '');
    if (s.endsWith('.') && !s.endsWith('..')) s = s.slice(0, -1).replace(/\s+$/, '');
    if (s === before) break;
  }
  return s.trim();
}

/** The title line of a stored description: its first non-empty line, with a proper **bold** wrapper removed */
export function titleFromDescription(description: string | null | undefined): string {
  const line = String(description ?? '').split('\n').find(l => l.trim() !== '') ?? '';
  const t = line.trim();
  const m = t.match(/^\*\*(.+)\*\*$/);
  return m ? m[1].trim() : t;
}

/**
 * Clean the title line of a stored description, leaving the body untouched. A **bold** title stays bold.
 * A single long line with no title/body split is body text and is left alone.
 */
export function cleanDescriptionTitle<T extends string | null | undefined>(description: T): T {
  if (typeof description !== 'string' || !description.trim()) return description;
  const m = description.match(/^(\s*)([^\n]*)([\s\S]*)$/);
  if (!m) return description;
  const [, indent, line, rest] = m;
  // One line only: there is no title/body split, so it is body text. Only drop heading markers.
  if (!rest.trim()) {
    const unmarked = line.replace(/^[\s]*[#>]+\s*/, '');
    return (unmarked === line ? description : `${indent}${unmarked}${rest}`) as T;
  }
  const bold = line.match(/^[\s#>]*\*\*(.+?)\*\*(.*)$/);
  if (bold && bold[2].trim()) return (line.replace(/^[\s#>]+/, '') + rest) as T; // "**Title** and some text": just drop heading markers
  const cleaned = cleanTitle(line);
  if (!cleaned) return description;
  const wasBold = /^[\s#>]*\*\*/.test(line);
  const out = wasBold ? `**${cleaned}**` : cleaned;
  return (out === line.trim() ? description : `${indent}${out}${rest}`) as T;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Whole-word / whole-phrase match of a breed name, allowing simple plural and possessive forms */
function mentionsBreed(title: string, breed: string): boolean {
  const body = escapeRe(breed.trim()).replace(/\s+/g, '[\\s-]+');
  const re = new RegExp(`(?<![\\p{L}\\p{N}])${body}(?:['’]s|s['’]|s|['’])?(?![\\p{L}\\p{N}])`, 'iu');
  return re.test(title);
}

export function titleIssues(input: { title: string; breedName?: string | null; allBreedNames: string[] }): string[] {
  const { title, breedName, allBreedNames } = input;
  const issues: string[] = [];
  const raw = String(title ?? '');
  const cleaned = cleanTitle(raw);
  if (cleaned !== raw.trim()) issues.push('markdown');
  if (!cleaned) issues.push('empty');
  const own = (breedName ?? '').trim();
  if (cleaned && own && !mentionsBreed(cleaned, own)) {
    const ownLower = own.toLowerCase();
    const other = allBreedNames.find(n => {
      const name = (n ?? '').trim();
      return name.length >= 4 && name.toLowerCase() !== ownLower && mentionsBreed(cleaned, name);
    });
    if (other) issues.push('breed_mismatch');
  }
  return issues;
}

export function findDuplicateTitles(rows: { id: string; title: string }[]): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  for (const r of rows) {
    const key = cleanTitle(r.title ?? '').toLowerCase();
    if (!key) continue;
    const list = groups.get(key);
    if (list) list.push(r.id); else groups.set(key, [r.id]);
  }
  Array.from(groups.entries()).forEach(([k, ids]) => { if (ids.length < 2) groups.delete(k); });
  return groups;
}
