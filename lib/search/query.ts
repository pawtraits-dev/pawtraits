/**
 * Turns what a customer types into a Postgres to_tsquery string for search_designs():
 * every word must match (in any field), each word also matches its synonyms
 * (xmas → christmas, mom → mum), and the last word matches as a prefix while typing.
 * Team nicknames and collection words ("toon", "chiefs", "nfl") don't need listing here:
 * they are part of each design's search document.
 */

/** Groups of words that mean the same thing. Multi-word entries become phrases. */
export const SYNONYM_GROUPS: string[][] = [
  ['christmas', 'xmas', 'festive', 'santa', 'noel', 'yule'],
  ['halloween', 'spooky', 'pumpkin'],
  ['valentine', 'valentines', 'love heart'],
  ['birthday', 'bday', 'party'],
  ['new year', 'nye', 'hogmanay'],
  ['mum', 'mom', 'mother', 'mama', 'mommy', 'mummy'],
  ['dad', 'father', 'papa', 'daddy'],
  ['royal', 'regal', 'king', 'queen', 'crown', 'majesty'],
  ['dog', 'puppy', 'pup', 'doggo', 'pooch'],
  ['cat', 'kitty', 'kitten', 'moggy'],
  ['jumper', 'sweater'],
  ['tux', 'tuxedo'],
  ['glasses', 'spectacles', 'specs'],
  ['grey', 'gray'],
  ['colour', 'color'],
  ['football', 'soccer', 'footie'],
  ['hockey', 'ice hockey'],
  ['basketball', 'hoops'],
  ['college', 'university', 'uni', 'varsity'],
  ['star sign', 'zodiac', 'horoscope'],
  ['pawsonality', 'personality'],
];

const LOOKUP = new Map<string, string[]>();
for (const g of SYNONYM_GROUPS) for (const w of g) LOOKUP.set(w, g);

const clean = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/['’]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const term = (w: string, prefix = false) => {
  const words = w.split(' ').filter(Boolean);
  return words.length > 1 ? `(${words.join(' <-> ')})` : `${words[0]}${prefix ? ':*' : ''}`;
};

export interface BuiltQuery { tsquery: string | null; words: string[] }

/** "Xmas spaniel" → "(xmas | christmas | festive | …) & spaniel:*" */
export function buildSearchQuery(input: string, opts: { prefix?: boolean } = {}): BuiltQuery {
  const text = clean(input).slice(0, 100);
  const raw = text.split(' ').filter(w => w.length > 0).slice(0, 8);
  const parts: string[] = [];
  const words: string[] = [];
  for (let i = 0; i < raw.length; i++) {
    // Two-word synonyms first ("ice hockey", "new year", "star sign")
    const pair = i + 1 < raw.length ? `${raw[i]} ${raw[i + 1]}` : null;
    const key = pair && LOOKUP.has(pair) ? pair : raw[i];
    if (key === pair) i++;
    words.push(key);
    const isLast = i === raw.length - 1;
    const alts = LOOKUP.get(key) ?? [key];
    const prefix = !!opts.prefix && isLast && key.length >= 3 && !key.includes(' ');
    const ordered = [key, ...alts.filter(a => a !== key)];
    parts.push(ordered.length > 1 ? `(${ordered.map(a => term(a, prefix && a === key)).join(' | ')})` : term(key, prefix));
  }
  return { tsquery: parts.length ? parts.join(' & ') : null, words };
}

/** Cleans a tag from the "See more …" link */
export function cleanTag(raw: string | null | undefined): string | null {
  const t = clean(raw ?? '').slice(0, 40);
  return t || null;
}
