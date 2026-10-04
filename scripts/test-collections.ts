/** Unit checks for collections (npm run test:collections) */
import { allCollections, inSeason, zodiacFor, suggestCollectionForTheme, OCCASIONS } from '../lib/collections/definitions';
import { cleanWindows, cleanTerms, slugify } from '../lib/collections/server';
import { SPORTS_TEAMS } from '../lib/collections/sports-teams';
import { cleanPath, orderOccasions, type PublicCollection } from '../lib/collections/public';
import { joinPetNames } from '../lib/text/pet-names';
import { recolourFor } from '../lib/collections/team-variants';

let pass = 0, fail = 0;
const ok = (name: string, cond: boolean, extra?: unknown) => { if (cond) pass++; else { fail++; console.log('FAIL', name, extra ?? ''); } };
const d = (s: string) => new Date(`${s}T12:00:00`);

// Seasons
ok('christmas in season 1 Dec', inSeason([{ start: '11-01', end: '12-26' }], d('2026-12-01')));
ok('christmas out 27 Dec', !inSeason([{ start: '11-01', end: '12-26' }], d('2026-12-27')));
ok('new year wraps: 31 Dec', inSeason([{ start: '12-26', end: '01-07' }], d('2026-12-31')));
ok('new year wraps: 3 Jan', inSeason([{ start: '12-26', end: '01-07' }], d('2027-01-03')));
ok('new year wraps: out 8 Jan', !inSeason([{ start: '12-26', end: '01-07' }], d('2027-01-08')));
const mothers = OCCASIONS.find(o => o.slug === 'mothers-day')!.seasons!;
ok('mothers day UK window', inSeason(mothers, d('2027-03-10')));
ok('mothers day US window', inSeason(mothers, d('2027-05-05')));
ok('mothers day gap', !inSeason(mothers, d('2027-04-10')));
ok('no windows = not seasonal', !inSeason([], d('2026-12-01')));
ok('boundary start inclusive', inSeason([{ start: '10-01', end: '10-31' }], d('2026-10-01')));
ok('boundary end inclusive', inSeason([{ start: '10-01', end: '10-31' }], d('2026-10-31')));

// Zodiac
ok('zodiac capricorn wraps 5 Jan', zodiacFor(d('2020-01-05')).slug === 'capricorn');
ok('zodiac capricorn 25 Dec', zodiacFor(d('2020-12-25')).slug === 'capricorn');
ok('zodiac pisces leap day', zodiacFor(d('2020-02-29')).slug === 'pisces');
ok('zodiac leo', zodiacFor(d('2020-08-01')).slug === 'leo');
let allDays = true;
for (let t = new Date('2020-01-01T12:00:00'); t.getFullYear() === 2020; t.setDate(t.getDate() + 1)) if (!zodiacFor(t)) allDays = false;
ok('every day of a leap year has a sign', allDays);

// Tree
const types = Array.from({ length: 16 }, (_, i) => ({ code: `T${String(i).padStart(3, '0')}`, dogName: `Dog ${i}`, catName: `Cat ${i}` }));
const all = allCollections(types);
const paths = new Set(all.map(c => c.path));
ok('183 collections', all.length === 4 + 11 + 5 + SPORTS_TEAMS.length + 16 + 12);
ok('paths unique', paths.size === all.length);
ok('parents before children', all.every((c, i) => !c.path.includes('/') || all.slice(0, i).some(p => p.path === c.path.slice(0, c.path.lastIndexOf('/')))));
ok('slugs valid', all.every(c => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(c.slug)));
ok('every team has an outfit', all.filter(c => c.path.split('/').length === 3 && c.kind === 'sport').every(c => c.outfit && c.outfit.clothing.length > 40 && c.outfit.colours.length >= 2));
ok('outfit slugs unique', new Set(all.filter(c => c.outfit).map(c => c.outfit!.slug)).size === SPORTS_TEAMS.length);
ok('no logos/crests in prompts', all.filter(c => c.outfit).every(c => c.outfit!.clothing.includes('no logos') && !/\b(logo|crest|badge|sponsor)/i.test(c.outfit!.clothing.replace(/Plain fabric with no [^.]*\./, ''))));
ok('miami present', paths.has('sports/college/miami'));
ok('team search terms lower-case', all.every(c => (c.searchTerms ?? []).every(t => t === t.toLowerCase())));

// Theme suggestions
ok('suggest christmas', suggestCollectionForTheme('Christmas Cosy') === 'occasions/christmas');
ok('suggest xmas', suggestCollectionForTheme('Xmas Jumpers') === 'occasions/christmas');
ok('suggest halloween', suggestCollectionForTheme('Spooky Halloween') === 'occasions/halloween');
ok('suggest valentines', suggestCollectionForTheme("Valentine's Love") === 'occasions/valentines-day');
ok('suggest mothers day', suggestCollectionForTheme("Mother's Day") === 'occasions/mothers-day');
ok('suggest birthday', suggestCollectionForTheme('Birthday Party') === 'occasions/birthday');
ok('suggest pawsonalities', suggestCollectionForTheme('Pawsonalities') === 'pawsonalities');
ok('suggest zodiac sign', suggestCollectionForTheme('Zodiac Leo') === 'zodiac/leo');
ok('suggest zodiac', suggestCollectionForTheme('Zodiac Signs') === 'zodiac');
ok('suggest nfl', suggestCollectionForTheme('NFL Game Day') === 'sports/nfl');
ok('suggest team', suggestCollectionForTheme('Arsenal Kit') === 'sports/premier-league/arsenal');
ok('no suggestion for Royal', suggestCollectionForTheme('Royal') === null);
ok('no suggestion for Renaissance', suggestCollectionForTheme('Renaissance Masters') === null);

// Input cleaning
ok('windows ok', 'windows' in cleanWindows([{ start: '11-01', end: '12-26' }]));
ok('windows bad month', 'error' in cleanWindows([{ start: '13-01', end: '12-26' }]));
ok('windows bad format', 'error' in cleanWindows([{ start: '1-1', end: '12-26' }]));
ok('windows not list', 'error' in cleanWindows('11-01'));
ok('windows max 4', 'error' in cleanWindows(Array(5).fill({ start: '01-01', end: '01-02' })));
ok('terms split + dedupe', JSON.stringify(cleanTerms('Xmas, festive, xmas, ')) === '["xmas","festive"]');
ok('slugify', slugify("St Patrick’s Day!") === 'st-patricks-day');
ok('slugify accents', slugify('Día de Muertos') === 'dia-de-muertos');

// Customer side
ok('cleanPath ok', cleanPath('/sports/nfl/kansas-city-chiefs/') === 'sports/nfl/kansas-city-chiefs');
ok('cleanPath rejects 4 levels', cleanPath('a/b/c/d') === null);
ok('cleanPath rejects odd chars', cleanPath('sports/../admin') === null && cleanPath("x' or 1=1") === null && cleanPath('') === null);
const occ = (slug: string, seasons: { start: string; end: string }[], sortOrder: number): PublicCollection => ({
  id: slug, kind: 'occasion', path: `occasions/${slug}`, parentPath: 'occasions', depth: 1, name: slug, shortName: null, description: null,
  designs: 1, heroImageId: null, seasonal: seasons.length > 0, inSeason: inSeason(seasons, d('2026-11-10')), seasons, details: {}, sortOrder,
});
const ordered = orderOccasions([occ('birthday', [], 10), occ('christmas', [{ start: '11-01', end: '12-26' }], 20), occ('thanksgiving', [{ start: '11-01', end: '11-28' }], 30), occ('halloween', [{ start: '10-01', end: '10-31' }], 5)], d('2026-11-10'));
ok('in season first, nearest end first', ordered.map(o => o.id).join() === 'thanksgiving,christmas,halloween,birthday', ordered.map(o => o.id).join());

// Several pets (multi-pet plan phase 1)
ok('names: two', joinPetNames(['Biscuit', 'Luna']) === 'Biscuit & Luna');
ok('names: three', joinPetNames(['Bo', 'Rex', 'Luna']) === 'Bo, Rex & Luna');
ok('names: placeholders dropped', joinPetNames(['Biscuit', 'Uploaded Pet', ' ']) === 'Biscuit' && joinPetNames([null, 'Uploaded Pet']) === 'Uploaded Pet');
const chiefsRecolour = 'Recolour the pet\'s sports outfit to Chiefs colours (red, gold): red jersey. Keep the same type of garment, cut, folds, pose, background and lighting; change only the colours and stripes.';
ok('recolour: one pet unchanged', recolourFor(chiefsRecolour, 1) === chiefsRecolour);
ok('recolour: two pets', recolourFor(chiefsRecolour, 2).startsWith('There are 2 pets. Recolour every pet\'s sports outfit, all in the same team kit, to Chiefs colours') && recolourFor(chiefsRecolour, 2).includes('Keep each pet’s type of garment'));
const realTeam = allCollections(types).find(c => c.path === 'sports/nfl/kansas-city-chiefs')!.metadata!.recolour_prompt as string;
ok('recolour: real team prompt reworded for two', recolourFor(realTeam, 2).startsWith('There are 2 pets.'));

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
