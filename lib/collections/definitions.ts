/**
 * The fixed collection tree (seeded by scripts/build-collections-seed.ts; names, order, seasons
 * and pictures are then edited in Admin → Collections). Sports teams come from ./sports-teams.
 */
import { LEAGUES, SPORTS_TEAMS, teamOutfit, type League } from './sports-teams';

export type CollectionKind = 'occasion' | 'sport' | 'pawsonality' | 'zodiac';
export interface SeasonWindow { start: string; end: string } // 'MM-DD', inclusive; may wrap the year end
export interface CollectionDef {
  kind: CollectionKind;
  path: string;
  slug: string;
  name: string;
  shortName?: string;
  description?: string;
  seasons?: SeasonWindow[];
  searchTerms?: string[];
  metadata?: Record<string, unknown>;
  outfit?: { slug: string; name: string; clothing: string; colours: string[]; keywords: string[] };
}

export const TOP_LEVEL: CollectionDef[] = [
  { kind: 'occasion', path: 'occasions', slug: 'occasions', name: 'Occasions', description: 'Christmas, birthdays, Halloween and every excuse for a party.' },
  { kind: 'sport', path: 'sports', slug: 'sports', name: 'Sports', description: 'Your pet in your team’s colours: Premier League, NFL, NBA, NHL and college.' },
  { kind: 'pawsonality', path: 'pawsonalities', slug: 'pawsonalities', name: '16 Pawsonalities', description: 'The Pawtrait for every type. Not sure which yours is? Take the quiz.' },
  { kind: 'zodiac', path: 'zodiac', slug: 'zodiac', name: 'Zodiac signs', description: 'Twelve signs, twelve masterpieces. Find your pet’s sign from their birthday.' },
];

export const OCCASIONS: Omit<CollectionDef, 'kind' | 'path'>[] = [
  { slug: 'christmas', name: 'Christmas', seasons: [{ start: '11-01', end: '12-26' }], searchTerms: ['xmas', 'festive', 'santa', 'christmas jumper', 'holidays'] },
  { slug: 'halloween', name: 'Halloween', seasons: [{ start: '10-01', end: '10-31' }], searchTerms: ['spooky', 'pumpkin', 'trick or treat'] },
  { slug: 'birthday', name: 'Birthday', searchTerms: ['birthday', 'party', 'cake', 'celebration'] },
  { slug: 'valentines-day', name: 'Valentine’s Day', shortName: 'Valentine’s', seasons: [{ start: '01-20', end: '02-14' }], searchTerms: ['valentine', 'valentines', 'love', 'hearts'] },
  { slug: 'mothers-day', name: 'Mother’s Day', seasons: [{ start: '02-20', end: '03-31' }, { start: '04-20', end: '05-12' }], searchTerms: ['mothers day', 'mothering sunday', 'mum', 'mom', 'dog mum', 'cat mum'] },
  { slug: 'easter', name: 'Easter', seasons: [{ start: '03-10', end: '04-25' }], searchTerms: ['easter', 'bunny', 'eggs', 'spring'] },
  { slug: 'fathers-day', name: 'Father’s Day', seasons: [{ start: '05-20', end: '06-21' }], searchTerms: ['fathers day', 'dad', 'dog dad', 'cat dad'] },
  { slug: 'st-patricks-day', name: 'St Patrick’s Day', seasons: [{ start: '03-01', end: '03-17' }], searchTerms: ['st patricks', 'paddys day', 'irish', 'shamrock'] },
  { slug: 'thanksgiving', name: 'Thanksgiving', seasons: [{ start: '11-01', end: '11-28' }], searchTerms: ['thanksgiving', 'turkey'] },
  { slug: 'new-year', name: 'New Year', seasons: [{ start: '12-26', end: '01-07' }], searchTerms: ['new year', 'new years eve', 'nye', 'hogmanay'] },
  { slug: 'gotcha-day', name: 'Gotcha Day', description: 'For the day they came home.', searchTerms: ['gotcha day', 'adoption', 'adopted', 'rescue', 'anniversary'] },
];

export const ZODIAC: { slug: string; name: string; symbol: string; from: string; to: string; element: string }[] = [
  { slug: 'aries', name: 'Aries', symbol: '♈', from: '03-21', to: '04-19', element: 'fire' },
  { slug: 'taurus', name: 'Taurus', symbol: '♉', from: '04-20', to: '05-20', element: 'earth' },
  { slug: 'gemini', name: 'Gemini', symbol: '♊', from: '05-21', to: '06-20', element: 'air' },
  { slug: 'cancer', name: 'Cancer', symbol: '♋', from: '06-21', to: '07-22', element: 'water' },
  { slug: 'leo', name: 'Leo', symbol: '♌', from: '07-23', to: '08-22', element: 'fire' },
  { slug: 'virgo', name: 'Virgo', symbol: '♍', from: '08-23', to: '09-22', element: 'earth' },
  { slug: 'libra', name: 'Libra', symbol: '♎', from: '09-23', to: '10-22', element: 'air' },
  { slug: 'scorpio', name: 'Scorpio', symbol: '♏', from: '10-23', to: '11-21', element: 'water' },
  { slug: 'sagittarius', name: 'Sagittarius', symbol: '♐', from: '11-22', to: '12-21', element: 'fire' },
  { slug: 'capricorn', name: 'Capricorn', symbol: '♑', from: '12-22', to: '01-19', element: 'earth' },
  { slug: 'aquarius', name: 'Aquarius', symbol: '♒', from: '01-20', to: '02-18', element: 'air' },
  { slug: 'pisces', name: 'Pisces', symbol: '♓', from: '02-19', to: '03-20', element: 'water' },
];

const LEAGUE_ORDER: League[] = ['premier-league', 'nfl', 'nba', 'nhl', 'college'];
const LEAGUE_TERMS: Record<League, string[]> = {
  'premier-league': ['premier league', 'epl', 'football', 'soccer', 'footie'],
  nfl: ['nfl', 'american football', 'gridiron'],
  nba: ['nba', 'basketball', 'hoops'],
  nhl: ['nhl', 'hockey', 'ice hockey'],
  college: ['college', 'university', 'ncaa', 'varsity'],
};

/** Every collection, parents before children (pawsonality types are passed in from the quiz content) */
export function allCollections(pawsonalityTypes: { code: string; dogName: string; catName: string }[]): CollectionDef[] {
  const out: CollectionDef[] = [...TOP_LEVEL];
  for (const o of OCCASIONS) out.push({ kind: 'occasion', path: `occasions/${o.slug}`, ...o });
  LEAGUE_ORDER.forEach(lg => {
    out.push({ kind: 'sport', path: `sports/${lg}`, slug: lg, name: LEAGUES[lg].name, searchTerms: LEAGUE_TERMS[lg], metadata: { league: lg, sport: LEAGUES[lg].sport } });
    for (const t of SPORTS_TEAMS.filter(x => x.league === lg)) {
      const prompts = teamOutfit(t);
      out.push({
        kind: 'sport', path: `sports/${lg}/${t.slug}`, slug: t.slug, name: t.name, shortName: t.short,
        searchTerms: Array.from(new Set([t.short.toLowerCase(), ...t.nicknames])),
        metadata: { league: lg, colours: t.colours, kit: t.kit, recolour_prompt: prompts.recolour },
        outfit: { slug: `team-${lg}-${t.slug}`, name: `${t.name} kit`, clothing: prompts.clothing, colours: t.colours.map(c => c.hex), keywords: ['sports', 'team', lg, LEAGUES[lg].sport] },
      });
    }
  });
  for (const p of pawsonalityTypes) {
    out.push({ kind: 'pawsonality', path: `pawsonalities/${p.code.toLowerCase()}`, slug: p.code.toLowerCase(), name: p.dogName, shortName: p.code, searchTerms: [p.code.toLowerCase(), p.catName.toLowerCase()], metadata: { code: p.code, dog_name: p.dogName, cat_name: p.catName } });
  }
  for (const z of ZODIAC) {
    out.push({ kind: 'zodiac', path: `zodiac/${z.slug}`, slug: z.slug, name: z.name, searchTerms: [z.slug, `${z.slug} season`], metadata: { symbol: z.symbol, from: z.from, to: z.to, element: z.element } });
  }
  return out;
}

/** Is today (or `date`) inside any of the windows? Windows may wrap the year end. */
export function inSeason(windows: SeasonWindow[] | null | undefined, date = new Date()): boolean {
  if (!windows?.length) return false;
  const md = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return windows.some(w => (w.start <= w.end ? md >= w.start && md <= w.end : md >= w.start || md <= w.end));
}

/** Zodiac sign for a birthday */
export function zodiacFor(date: Date): (typeof ZODIAC)[number] {
  const md = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return ZODIAC.find(z => (z.from <= z.to ? md >= z.from && md <= z.to : md >= z.from || md <= z.to))!;
}

/** Suggested collection path for a theme, from its name (admin "Suggest from names") */
export function suggestCollectionForTheme(themeName: string): string | null {
  const n = themeName.toLowerCase();
  for (const o of OCCASIONS) {
    if ([o.slug.replace(/-/g, ' '), o.name.toLowerCase(), ...(o.searchTerms ?? [])].some(t => t.length > 3 && n.includes(t.replace(/’/g, "'").replace(/'/g, '')) || n.replace(/['’]/g, '').includes(t.replace(/['’]/g, '')))) return `occasions/${o.slug}`;
  }
  if (/pawsonalit/.test(n)) return 'pawsonalities';
  for (const z of ZODIAC) if (n.includes(z.slug)) return `zodiac/${z.slug}`;
  if (/zodiac|horoscope|star sign/.test(n)) return 'zodiac';
  for (const t of SPORTS_TEAMS) if (n.includes(t.name.toLowerCase())) return `sports/${t.league}/${t.slug}`;
  if (/premier league|soccer|football kit/.test(n)) return 'sports/premier-league';
  if (/\bnfl\b|american football|quarterback/.test(n)) return 'sports/nfl';
  if (/\bnba\b|basketball/.test(n)) return 'sports/nba';
  if (/\bnhl\b|hockey/.test(n)) return 'sports/nhl';
  if (/college|varsity|university/.test(n)) return 'sports/college';
  if (/sport|football|team|stadium/.test(n)) return 'sports';
  return null;
}
