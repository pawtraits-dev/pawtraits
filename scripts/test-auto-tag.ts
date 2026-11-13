// Run: npx tsx scripts/test-auto-tag.ts   (no network: the model is injected)
import { autoTagImage, buildPrompt, limitSingles, parseTagReply } from '../lib/collections/auto-tag';

let pass = 0, fail = 0;
const ok = (name: string, cond: boolean, extra?: unknown) => { if (cond) pass++; else { fail++; console.log('FAIL', name, extra ?? ''); } };
const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

// Pure guard
const three = ['zodiac/aries', 'zodiac/leo', 'zodiac/gemini'];
ok('one sign passes', eq(limitSingles(['zodiac/aries'], ''), ['zodiac/aries']));
ok('three signs, none named: none kept', eq(limitSingles(three, 'a ram in a starry sky'), []));
ok('three signs, one named in the text: that one', eq(limitSingles(three, 'Zodiac Aries — a ram-horned pup'), ['zodiac/aries']));
ok('name match is by whole word', eq(limitSingles(['zodiac/leo', 'zodiac/virgo'], 'a galeon at sea, Virgo season'), ['zodiac/virgo']));
ok('two named: no guess', eq(limitSingles(['zodiac/leo', 'zodiac/virgo'], 'Leo and Virgo together'), []));
ok('admin sign link: no automatic sign', eq(limitSingles(['zodiac/aries'], 'Aries', { adminKinds: ['zodiac'] }), []));
ok('admin sign link leaves tarot alone', eq(limitSingles(['zodiac/aries', 'tarot/the-fool'], 'The Fool', { adminKinds: ['zodiac'] }), ['tarot/the-fool']));
ok('tarot: two cards, one named by its text', eq(limitSingles(['tarot/the-fool', 'tarot/the-star'], 'Tarot: The Star'), ['tarot/the-star']));
ok('tarot slug with hyphens matches the name', eq(limitSingles(['tarot/the-high-priestess', 'tarot/the-sun'], 'the high priestess card'), ['tarot/the-high-priestess']));
ok('other paths and order are kept', eq(limitSingles(['occasions/christmas', ...three, 'pawsonalities/esfb'], 'Aries'), ['occasions/christmas', 'zodiac/aries', 'pawsonalities/esfb']));
ok('duplicates collapse', eq(limitSingles(['zodiac/aries', 'zodiac/aries'], ''), ['zodiac/aries']));

// Prompt
const prompt = buildPrompt({ pawsonalities: [] }, { theme: 'Aries' });
ok('prompt: one sign, decoration, tarot list', /at most ONE zodiac sign/.test(prompt) && /decoration/.test(prompt) && /tarot\/the-fool \(The Fool\)/.test(prompt) && /tarot\/the-world \(The World\)/.test(prompt) && /Tarot only if the text says so/.test(prompt));
ok('parse keeps tarot paths', eq(parseTagReply('{"collections":["tarot/the-fool","zodiac/leo"],"tags":[]}', new Set(['tarot/the-fool', 'zodiac/leo']))?.collections, ['tarot/the-fool', 'zodiac/leo']));

// End to end with a fake database and model: the Aries design with a starry background
function fakeDb(adminZodiac: boolean) {
  const cols = [
    ...['aries', 'leo', 'gemini'].map((s, i) => ({ id: `z${i}`, path: `zodiac/${s}`, name: s[0].toUpperCase() + s.slice(1), kind: 'zodiac', depth: 1, outfit_id: null })),
  ];
  const links: any[] = adminZodiac ? [{ source: 'admin', excluded: false, collections: { kind: 'zodiac', depth: 1 } }] : [];
  let upserted: any[] = [];
  const row = { id: 'img', prompt_text: 'Aries pup, ram horns', description: null, marketing_description: null, tags: [], is_customer_generated: false, cloudinary_public_id: null, public_url: null, breeds: { name: 'Beagle' }, themes: { name: 'Zodiac Aries' }, outfits: null };
  const q = (table: string) => {
    const chain: any = {
      select: () => chain, eq: () => chain, neq: () => chain, order: () => chain, update: () => chain, delete: () => chain,
      upsert: (r: any[]) => { upserted = r; return chain; },
      maybeSingle: async () => ({ data: table === 'image_catalog' ? row : null }),
      then: (f: any) => f({ data: table === 'collections' ? cols : table === 'design_collections' ? links : [] }),
    };
    return chain;
  };
  return { db: { from: q }, upserted: () => upserted };
}
(async () => {
  const model = async () => '{"collections":["zodiac/aries","zodiac/leo","zodiac/gemini"],"team":null,"tags":["ram horns"],"confidence":0.9}';
  const a = fakeDb(false);
  const r1 = await autoTagImage(a.db, 'img', { model, force: true });
  ok('end to end: only Aries is linked', r1.ok && eq(r1.answer.collections, ['zodiac/aries']) && eq(a.upserted().map((x: any) => x.collection_id), ['z0']), r1);
  const b = fakeDb(true);
  const r2 = await autoTagImage(b.db, 'img', { model, force: true });
  ok('end to end: admin link means no automatic sign', r2.ok && eq(r2.answer.collections, []) && b.upserted().length === 0, r2);
  console.log(fail ? `${fail} failed, ${pass} passed` : `${pass} passed`);
  process.exit(fail ? 1 : 0);
})();
