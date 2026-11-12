/** Run: npx tsx scripts/test-browse-query.ts — unit tests for lib/catalog/browse-query.ts (pure helpers) */
import {
  sanitiseSearch, clampLimit, clampPage, isUuid, parseAnimal,
  animalOrFilter, breedOrFilter, searchOrFilter, buildFacets,
} from '../lib/catalog/browse-query';

let failed = 0;
function eq(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `\n   expected ${JSON.stringify(expected)}\n   got      ${JSON.stringify(actual)}`}`);
}

const U1 = '11111111-1111-4111-8111-111111111111';
const U2 = '22222222-2222-4222-8222-222222222222';

// sanitiseSearch
eq('sanitise: commas and parens removed', sanitiseSearch('golden,(fluffy)'), 'golden fluffy');
eq('sanitise: percent, underscore, star removed', sanitiseSearch('100%_a*b'), '100 a b');
eq('sanitise: quotes/braces/backslash removed', sanitiseSearch('a"b{c}\\d'), 'a b c d');
eq('sanitise: lowercased, trimmed, collapsed', sanitiseSearch('  Golden   RETRIEVER '), 'golden retriever');
eq('sanitise: keeps hyphen, apostrophe, accents', sanitiseSearch("Café d'or-x"), "café d'or-x");
eq('sanitise: only junk gives empty', sanitiseSearch('%%,,()'), '');
eq('sanitise: non-string gives empty', sanitiseSearch(undefined), '');
eq('sanitise: capped at 50 chars', sanitiseSearch('a'.repeat(80)).length, 50);
eq('sanitise: or-injection attempt neutralised', sanitiseSearch('x),is_public.eq.false,(y'), 'x is public eq false y');

// clamps
eq('limit: default', clampLimit(null), 24);
eq('limit: 0 -> 1', clampLimit('0'), 1);
eq('limit: 500 -> 48', clampLimit('500'), 48);
eq('limit: garbage -> default', clampLimit('abc'), 24);
eq('limit: 12.9 -> 12', clampLimit('12.9'), 12);
eq('page: default', clampPage(null), 1);
eq('page: negative -> 1', clampPage('-4'), 1);
eq('page: 3', clampPage('3'), 3);
eq('page: huge capped', clampPage('99999999'), 10000);

// ids / animal
eq('isUuid ok', isUuid(U1), true);
eq('isUuid rejects injection', isUuid(`${U1},is_public.eq.false`), false);
eq('parseAnimal', [parseAnimal('dog'), parseAnimal('cat'), parseAnimal('cow'), parseAnimal(null)], ['dog', 'cat', null, null]);

// filters
eq('animal cat', animalOrFilter('cat', [U1, U2]), `breed_id.in.(${U1},${U2}),tags.cs.{cat}`);
eq('animal cat, no cat breeds', animalOrFilter('cat', []), 'tags.cs.{cat}');
eq('animal dog', animalOrFilter('dog', [U1]),
  `and(breed_id.not.is.null,breed_id.not.in.(${U1})),tags.cs.{dog},and(breed_id.is.null,or(tags.is.null,tags.not.cs.{cat}))`);
eq('animal filter drops non-uuid ids', animalOrFilter('cat', [U1, 'x),evil']), `breed_id.in.(${U1}),tags.cs.{cat}`);
eq('breed filter', breedOrFilter(U1), `breed_id.eq.${U1},generation_parameters.cs.{"subjects":[{"breedId":"${U1}"}]}`);
eq('breed filter rejects bad id', breedOrFilter('nope'), null);
eq('search filter', searchOrFilter('Golden, fluffy', [U1]), `description.ilike.%golden fluffy%,tags.cs.{"golden fluffy"},breed_id.in.(${U1})`);
eq('search filter empty', searchOrFilter('%%', []), null);

// facets
const f = buildFacets(
  [
    { breed_id: U1, theme_id: 't1', format_id: 'f1', subjects: [{ breedId: U1 }, { breedId: U2 }] },
    { breed_id: U1, theme_id: 't1', format_id: 'f2', subjects: null },
    { breed_id: null, theme_id: 't2', format_id: null, subjects: [] },
  ],
  { [U1]: 'dog', [U2]: 'cat' },
);
eq('facets byBreed (pets counted once per design)', f.byBreed, { [U1]: 2, [U2]: 1 });
eq('facets byTheme', f.byTheme, { t1: 2, t2: 1 });
eq('facets themeAnimal', f.themeAnimal, { t1: { dogs: 2, cats: 1 }, t2: { dogs: 0, cats: 0 } });
eq('facets breedFormats', f.breedFormats, { [U1]: ['f1', 'f2'], [U2]: ['f1'] });

if (failed) { console.error(`\n${failed} assertion(s) failed`); process.exit(1); }
console.log('\nAll assertions passed');
