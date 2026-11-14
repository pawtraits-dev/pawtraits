/** Run: npx tsx scripts/test-browse-params.ts — unit tests for lib/catalog/browse-params.ts (URL -> filters -> designs query) */
import {
  browseApiParamsFromKey, browseGridKey, browseGridVisible, browseStateFromGetter, browseStateFromRecord, browseUrlFor,
} from '../lib/catalog/browse-params';

let failed = 0;
function eq(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `\n   expected ${JSON.stringify(expected)}\n   got      ${JSON.stringify(actual)}`}`);
}

const B = '11111111-1111-4111-8111-111111111111';
const T = '22222222-2222-4222-8222-222222222222';
const state = (q: string) => browseStateFromGetter(n => new URLSearchParams(q).get(n));

// URL -> state
eq('state: empty url is the All tab', state(''), { tab: 'all', breed: '', theme: '', search: '' });
eq('state: type=dogs', state('type=dogs').tab, 'dogs');
eq('state: type=cats', state('type=cats').tab, 'cats');
eq('state: type=themes', state('type=themes').tab, 'themes');
eq('state: unknown type falls back to all', state('type=bananas').tab, 'all');
eq('state: type=all is all', state('type=all').tab, 'all');
eq('state: breed, theme, search read as is', state(`breed=${B}&theme=${T}&search=Golden%20Fluffy`), { tab: 'all', breed: B, theme: T, search: 'Golden Fluffy' });
eq('state: server record and URLSearchParams agree', browseStateFromRecord({ type: 'cats', breed: B, search: 'x' }), state(`type=cats&breed=${B}&search=x`));
eq('state: repeated param: first value wins (like .get)', browseStateFromRecord({ breed: [B, T] }).breed, B);
eq('state: undefined record is the All tab', browseStateFromRecord(undefined), { tab: 'all', breed: '', theme: '', search: '' });
eq('state: empty string params are none', browseStateFromRecord({ breed: '', search: '' }), { tab: 'all', breed: '', theme: '', search: '' });

// grid visible
eq('visible: All tab', browseGridVisible(state('')), true);
eq('visible: dogs tab shows breed cards, no grid', browseGridVisible(state('type=dogs')), false);
eq('visible: themes tab shows theme cards, no grid', browseGridVisible(state('type=themes')), false);
eq('visible: dogs tab with a breed shows the grid', browseGridVisible(state(`type=dogs&breed=${B}`)), true);
eq('visible: themes tab with a theme shows the grid', browseGridVisible(state(`type=themes&theme=${T}`)), true);

// grid key (the designs query)
eq('key: All tab has no filters', browseGridKey(state('')), '');
eq('key: dogs tab without selection has no grid', browseGridKey(state('type=dogs')), '');
eq('key: breed', browseGridKey(state(`type=dogs&breed=${B}`)), `breed=${B}`);
eq('key: breed + search (search narrows inside a breed)', browseGridKey(state(`breed=${B}&search=golden`)), `breed=${B}&search=golden`);
eq('key: search is trimmed', browseGridKey(state(`breed=${B}&search=%20golden%20`)), `breed=${B}&search=golden`);
eq('key: search without a breed is ignored on the All tab', browseGridKey(state('search=golden')), '');
eq('key: theme', browseGridKey(state(`type=themes&theme=${T}`)), `theme=${T}`);
eq('key: theme view ignores the tab for animal', browseGridKey(state(`type=dogs&theme=${T}`)), `theme=${T}`);
eq('key: breed wins over theme tab animal', browseGridKey(state(`type=cats&breed=${B}`)), `breed=${B}`);
eq('key: theme and breed together keep both (order breed, theme)', browseGridKey(state(`theme=${T}&breed=${B}`)), `breed=${B}&theme=${T}`);
eq('key: theme extras (animal, breed name search)', browseGridKey(state(`theme=${T}`), { themeAnimal: 'cats', themeBreedSearch: ' lab ' }), `theme=${T}&animal=cat&breedName=lab`);
eq('key: theme extras dogs', browseGridKey(state(`theme=${T}`), { themeAnimal: 'dogs' }), `theme=${T}&animal=dog`);
eq('key: theme extras are ignored without a theme', browseGridKey(state('type=dogs'), { themeAnimal: 'cats', themeBreedSearch: 'x' }), '');
eq('key: same URL, same key on server and client path', browseGridKey(browseStateFromRecord({ breed: B, search: 'a b' })), browseGridKey(state(`breed=${B}&search=a%20b`)));

// state -> URL (address bar)
eq('url: All tab', browseUrlFor(state('')), '/browse');
eq('url: dogs tab', browseUrlFor(state('type=dogs')), '/browse?type=dogs');
eq('url: round trip', browseUrlFor(state(`type=cats&search=a&breed=${B}&theme=${T}`)), `/browse?type=cats&search=a&breed=${B}&theme=${T}`);
eq('url: type=all is dropped', browseUrlFor(state('type=all')), '/browse');

// key -> API query
eq('api: empty key is page 1 of everything', browseApiParamsFromKey('', 1, 24), { page: 1, limit: 24, breed: null, theme: null, animal: null, search: null, breedName: null });
eq('api: full key', browseApiParamsFromKey(`breed=${B}&theme=${T}&animal=cat&search=x&breedName=lab`, 2, 24), { page: 2, limit: 24, breed: B, theme: T, animal: 'cat', search: 'x', breedName: 'lab' });
eq('api: encoded text survives the round trip', browseApiParamsFromKey(browseGridKey(state(`breed=${B}&search=caf%C3%A9%20%26%20co`)), 1, 24).search, 'café & co');

console.log(failed ? `\n${failed} FAILED` : '\nAll passed');
process.exit(failed ? 1 : 0);
