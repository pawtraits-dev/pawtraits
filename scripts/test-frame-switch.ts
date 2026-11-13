// Run: CLOUDINARY_CLOUD_NAME=demo CLOUDINARY_API_KEY=x CLOUDINARY_API_SECRET=x npx tsx scripts/test-frame-switch.ts   (no network)
import { FRAME_IN_BASKET, FRAME_ORDERED, frameState, metaWithFrame, metaWithoutFrame, switchBlocked, unframedBaseId } from '../lib/frames/switch';
import { framedProductAllowed, isFramed } from '../lib/frames/rules';
import { frameExempt, frameIfCard } from '../lib/frames/server';

let pass = 0, fail = 0;
const ok = (name: string, cond: boolean, extra?: unknown) => { if (cond) pass++; else { fail++; console.log('FAIL', name, extra ?? ''); } };

// The state of a customer's portrait
const framed = { theme: 'Leo', clean_cloudinary_id: 'clean1', clean_url: 'https://x/clean1', full_size_url: 'https://x/framed',
  frame: { style: 'celestial', title: 'DAISY · LEO', tagline: 'Born to Rule', medallion: { symbol: 'leo' }, pet_name: 'Daisy', base_cloudinary_id: 'base1', animal: 'dog' }, timings: { a: 1 } };
ok('framed: state on, isFramed', frameState(framed) === 'on' && isFramed({ generation_metadata: framed }));
const off = metaWithoutFrame(framed)!;
ok('switching off: no frame key, card kept as frame_off', !('frame' in off) && off.frame_off.title === 'DAISY · LEO' && off.frame_off.pet_name === 'Daisy' && off.frame_off.base_cloudinary_id === 'base1');
ok('unframed: state off, isFramed is false (prints-only rule does not apply)', frameState(off) === 'off' && !isFramed({ generation_metadata: off }));
ok('other metadata is kept', off.theme === 'Leo' && off.clean_cloudinary_id === 'clean1' && off.timings.a === 1);
ok('nothing to set aside when not framed', metaWithoutFrame(off) === null && metaWithoutFrame({}) === null);
ok('base id: from the frame, the frame_off, else the displayed picture', unframedBaseId(framed, 'baked') === 'base1' && unframedBaseId(off, 'base1') === 'base1' && unframedBaseId({}, 'shown') === 'shown' && unframedBaseId({}, null) === null);

const card = { title: 'ROVER · LEO', tagline: 'Born to Rule', medallion: { symbol: 'leo' } };
const on = metaWithFrame(off, { card, petName: 'Rover', animal: 'dog', baseId: 'base1', framedUrl: 'https://x/framed2' });
ok('switching back on: frame returns with the new name, frame_off is gone', frameState(on) === 'on' && on.frame.title === 'ROVER · LEO' && on.frame.pet_name === 'Rover' && !('frame_off' in on) && on.frame.base_cloudinary_id === 'base1' && on.full_size_url === 'https://x/framed2');
ok('the style is kept', on.frame.style === 'celestial');
const fresh = metaWithFrame({ theme: 'Leo' }, { card, petName: null, baseId: 'paint1', baseUrl: 'https://x/paint1', framedUrl: 'https://x/f' });
ok('made without the frame, then framed: the clean painting is recorded for print files', fresh.clean_cloudinary_id === 'paint1' && fresh.clean_url === 'https://x/paint1' && fresh.frame.base_cloudinary_id === 'paint1' && fresh.frame.pet_name === null);
ok('round trip keeps the clean painting', metaWithFrame(metaWithoutFrame(framed)!, { card: { title: framed.frame.title, tagline: framed.frame.tagline, medallion: framed.frame.medallion }, petName: 'Daisy', baseId: 'base1', framedUrl: 'u' }).clean_cloudinary_id === 'clean1');
ok('a frame with no title is not a frame', frameState({ frame: { title: '' } }) === null && frameState(null) === null && !isFramed({ generation_metadata: { frame_off: framed.frame } }));

// What blocks a switch
const print = { product_type: 'print', name: 'A3 print' }, mug = { product_type: 'merchandise', name: 'Mug 11oz' }, dl = { product_type: 'digital_download', name: 'Digital' };
ok('ordered: refused both ways', switchBlocked('on', { ordered: true, basketProducts: [] }, framedProductAllowed) === FRAME_ORDERED && switchBlocked('off', { ordered: true, basketProducts: [] }, framedProductAllowed) === FRAME_ORDERED);
ok('prints in the basket: fine either way', switchBlocked('on', { ordered: false, basketProducts: [print] }, framedProductAllowed) === null && switchBlocked('off', { ordered: false, basketProducts: [print] }, framedProductAllowed) === null);
ok('mug or download in the basket: no framing', switchBlocked('on', { ordered: false, basketProducts: [print, mug] }, framedProductAllowed) === FRAME_IN_BASKET && switchBlocked('on', { ordered: false, basketProducts: [dl] }, framedProductAllowed) === FRAME_IN_BASKET);
ok('unframing is never blocked by the basket', switchBlocked('off', { ordered: false, basketProducts: [mug, dl] }, framedProductAllowed) === null);

// Which designs the frame never touches
ok('customer and quiz pictures are exempt', frameExempt({ is_customer_generated: true }) && frameExempt({ tags: ['x', 'quiz-generated'] }) && !frameExempt({ tags: ['x'] }) && !frameExempt({}));

(async () => {
  // frameIfCard never throws and does nothing for the exempt or card-less designs
  const fake = (row: any, links: any[] = []) => ({
    from: (table: string) => {
      const chain: any = {
        select: () => chain, eq: () => chain, in: () => chain, limit: () => chain, order: () => chain,
        maybeSingle: async () => ({ data: table === 'image_catalog' ? row : null, error: null }),
        then: (f: any) => f({ data: table === 'design_collections' ? links : table === 'collections' ? [] : [], error: null }),
      };
      return chain;
    },
  }) as any;
  ok('no id: skipped', (await frameIfCard(fake(null), null)) === 'skipped');
  ok('customer portrait: skipped', (await frameIfCard(fake({ id: 'a', is_customer_generated: true }), 'a')) === 'skipped');
  ok('quiz breed picture: skipped', (await frameIfCard(fake({ id: 'a', tags: ['quiz-generated'] }), 'a')) === 'skipped');
  ok('not in a sign or card, no frame: unchanged', (await frameIfCard(fake({ id: 'a', tags: [], frame_overlay: null }), 'a')) === 'unchanged');
  // Taken out of its sign or card (no link left): the frame comes off and the clean picture comes back
  const updates: any[] = [];
  const framedRow = { id: 'a', tags: [], cloudinary_public_id: 'framed-copy', caption_overlay: null, frame_overlay: { style: 'celestial', clean_public_id: 'clean-pic', applied: { title: 'LEO', tagline: null, medallion: { symbol: 'leo' }, at: '2026-11-13' } } };
  const db2: any = { from: (table: string) => {
    const chain: any = {
      select: () => chain, eq: () => chain, in: () => chain, limit: () => chain, order: () => chain,
      update: (f: any) => { updates.push(f); return chain; },
      maybeSingle: async () => ({ data: table === 'image_catalog' ? { ...framedRow, variation_of: null, breed_id: null, breeds: null } : null, error: null }),
      then: (f: any) => f({ data: [], error: null }),
    };
    return chain;
  } };
  ok('removed from its sign: unframed', (await frameIfCard(db2, 'a')) === 'unframed' && updates.length === 1 && updates[0].cloudinary_public_id === 'clean-pic' && updates[0].frame_overlay === null, updates);
  const boom = { from: () => { throw new Error('db down'); } } as any;
  const log = console.error; console.error = () => {};
  ok('a failing database: "failed", never thrown', (await frameIfCard(boom, 'a')) === 'failed');
  console.error = log;
  console.log(fail ? `${fail} failed, ${pass} passed` : `${pass} passed`);
  process.exit(fail ? 1 : 0);
})();
