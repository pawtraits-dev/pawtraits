/**
 * What may be shown publicly about a social item: the pet's first name and a town + country.
 * Never customer names, emails, streets, house numbers or postcodes.
 */

const NAME_WORD = /^[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ'’-]{0,19}$/;
const PLACEHOLDER_NAMES = new Set(['uploaded pet', 'pet', 'my pet', 'unknown', 'dog', 'cat']);

const titleCase = (w: string) => w.charAt(0).toLocaleUpperCase('en-GB') + w.slice(1).toLocaleLowerCase('en-GB');

/** "biscuit the brave" → "Biscuit"; placeholders, numbers and anything odd → null */
export function petFirstName(raw: string | null | undefined): string | null {
  const s = (raw ?? '').trim();
  if (!s || PLACEHOLDER_NAMES.has(s.toLowerCase())) return null;
  const first = s.split(/\s+/)[0].replace(/[.,!?]+$/, '');
  return NAME_WORD.test(first) ? titleCase(first) : null;
}

/** First names of every pet in a portrait: "Biscuit", "Biscuit & Mochi" (max 30 chars) */
export function petNames(names: (string | null | undefined)[]): string | null {
  const firsts = Array.from(new Set(names.map(petFirstName).filter((n): n is string => !!n)));
  if (!firsts.length) return null;
  let out = firsts[0];
  for (const n of firsts.slice(1)) {
    const next = `${out} & ${n}`;
    if (next.length > 30) break;
    out = next;
  }
  return out;
}

/** "  NEW york " → "New York"; rejects anything with digits (postcodes, house numbers) or too long */
export function cleanTown(raw: string | null | undefined): string | null {
  const s = (raw ?? '').replace(/\s+/g, ' ').trim();
  if (!s || s.length > 40 || /\d/.test(s) || /[@#/\\]/.test(s)) return null;
  return s.split(/([ -])/).map(p => (/^[ -]$/.test(p) ? p : p.length <= 2 && p === p.toLowerCase() ? p : titleCase(p))).join('');
}

const SHORT_COUNTRY: Record<string, string> = { GB: 'UK', US: 'USA', AE: 'UAE' };
const NAME_TO_CODE: Record<string, string> = {
  'united kingdom': 'GB', 'great britain': 'GB', uk: 'GB', england: 'GB', scotland: 'GB', wales: 'GB', 'northern ireland': 'GB',
  'united states': 'US', usa: 'US', 'united states of america': 'US',
};

/** "GB" / "United Kingdom" → "UK"; "DE" → "Germany"; unknown text kept if it looks like a country name */
export function countryLabel(raw: string | null | undefined): string | null {
  const s = (raw ?? '').trim();
  if (!s) return null;
  const upper = s.toUpperCase();
  const code = upper === 'UK' ? 'GB' : /^[A-Za-z]{2}$/.test(s) ? upper : NAME_TO_CODE[s.toLowerCase()];
  if (code) {
    if (SHORT_COUNTRY[code]) return SHORT_COUNTRY[code];
    try {
      const name = new Intl.DisplayNames(['en-GB'], { type: 'region' }).of(code);
      if (name && name !== code) return name;
    } catch { /* unknown code */ }
    return null;
  }
  return /^[A-Za-zÀ-ÖØ-öø-ÿ .'-]{3,40}$/.test(s) ? s : null;
}

/** "Derby, UK" / "UK" / null */
export function placeLabel(town: string | null, country: string | null): string | null {
  return [town, country].filter(Boolean).join(', ') || null;
}
