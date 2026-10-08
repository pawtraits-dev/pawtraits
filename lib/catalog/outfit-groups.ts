import { LEAGUES, SPORTS_TEAMS, type League, type TeamColour } from '@/lib/collections/sports-teams';

// Team kits are outfits with slug `team-<league>-<team>` (seeded from lib/collections/sports-teams.ts).
// The variation pickers show them grouped by league, like coats under a breed.

export interface OutfitLike { id: string; name: string; slug?: string | null; clothing_description?: string | null }
export interface TeamOutfit<T extends OutfitLike> { outfit: T; label: string; colours: TeamColour[] }
export interface LeagueGroup<T extends OutfitLike> { league: League; name: string; teams: TeamOutfit<T>[] }

const LEAGUE_ORDER = Object.keys(LEAGUES) as League[];
const teamBySlug = new Map(SPORTS_TEAMS.map((t) => [`team-${t.league}-${t.slug}`, t]));

export function leagueOf(slug: string | null | undefined): League | null {
  if (!slug?.startsWith('team-')) return null;
  const known = teamBySlug.get(slug);
  if (known) return known.league;
  return LEAGUE_ORDER.find((l) => slug.startsWith(`team-${l}-`)) ?? null;
}

export function matchesOutfitSearch(o: OutfitLike, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const team = o.slug ? teamBySlug.get(o.slug) : undefined;
  return (
    o.name.toLowerCase().includes(q) ||
    (o.clothing_description || '').toLowerCase().includes(q) ||
    (!!team && (team.nicknames.some((n) => n.toLowerCase().includes(q)) || LEAGUES[team.league].name.toLowerCase().includes(q)))
  );
}

export function groupOutfits<T extends OutfitLike>(outfits: T[]): { everyday: T[]; leagues: LeagueGroup<T>[] } {
  const everyday: T[] = [];
  const byLeague = new Map<League, TeamOutfit<T>[]>();
  for (const o of outfits) {
    const league = leagueOf(o.slug);
    if (!league) { everyday.push(o); continue; }
    const team = teamBySlug.get(o.slug!);
    const label = team?.name ?? o.name.replace(/ kit$/i, '');
    const list = byLeague.get(league) ?? [];
    list.push({ outfit: o, label, colours: team?.colours.slice(0, 3) ?? [] });
    byLeague.set(league, list);
  }
  const leagues = LEAGUE_ORDER.filter((l) => byLeague.has(l)).map((l) => ({
    league: l,
    name: LEAGUES[l].name,
    teams: byLeague.get(l)!.sort((a, b) => a.label.localeCompare(b.label)),
  }));
  return { everyday, leagues };
}
