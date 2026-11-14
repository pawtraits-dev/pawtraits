// Run: npx tsx scripts/test-referral-share.ts   (no network, no database)
import { PDFDocument, StandardFonts } from 'pdf-lib';
import {
  REFERRAL_COPY, bannerText, buildShareUrl, normaliseCode, safeFirstName, shareMessage, sharePageUrl, sharePetName, shareText, shortLink, whatsappUrl, REFERRAL_STORAGE_KEY,
} from '../lib/referrals/text';
import { generatePackingSlips, referralPanelLine, wrapText } from '../lib/fulfillment/packing-slips';
import { qrMatrix } from '../lib/qr/render';
import { renderTemplate } from '../lib/messaging/template-engine';

let pass = 0, fail = 0;
const ok = (name: string, cond: boolean, extra?: unknown) => { if (cond) pass++; else { fail++; console.log('FAIL', name, extra ?? ''); } };

// Share text (exact wording)
ok('text with pet', shareText('Biscuit') === "I had Biscuit painted by Pawcasso at Pawtraits. Here's 10% off your first one:");
ok('text without pet', shareText() === "I had my pet painted by Pawcasso at Pawtraits. Here's 10% off your first one:");
ok('text placeholder pet', shareText('Uploaded Pet') === shareText(null));
ok('text odd pet name', shareText('<b>x</b>') === shareText(null) && shareText('R2D2') === shareText(null));
ok('pet name tidy', sharePetName('biscuit the brave') === 'Biscuit' && sharePetName("  O'Malley ") === "O'malley");
ok('message', shareMessage('https://x.test/c/A', 'Biscuit') === "I had Biscuit painted by Pawcasso at Pawtraits. Here's 10% off your first one: https://x.test/c/A");

// Names
ok('first name', safeFirstName('sarah jones') === 'Sarah' && safeFirstName('  JO ') === 'Jo');
ok('name: digits/symbols/email rejected', safeFirstName('s4rah') === null && safeFirstName('a@b.com') === null && safeFirstName('<script>') === null && safeFirstName('') === null && safeFirstName(null) === null);
ok('name: hyphen', safeFirstName('Anne-Marie Smith') === 'Anne-marie');

// Links
const id = '123e4567-e89b-12d3-a456-426614174000';
ok('link', buildShareUrl('https://pawtraits.pics', 'abcd1234') === 'https://pawtraits.pics/c/ABCD1234');
ok('link trailing slash', buildShareUrl('https://pawtraits.pics/', 'ABCD1234') === 'https://pawtraits.pics/c/ABCD1234');
ok('link with design', buildShareUrl('https://x.test', 'ABCD1234', id) === `https://x.test/c/ABCD1234?d=${id}`);
ok('link ignores bad design', buildShareUrl('https://x.test', 'ABCD1234', 'nope') === 'https://x.test/c/ABCD1234');
ok('short link', shortLink('https://pawtraits.pics', 'abcd1234') === 'pawtraits.pics/c/ABCD1234');
ok('share page', sharePageUrl('https://pawtraits.pics', 'abcd1234') === 'https://pawtraits.pics/share/referral/ABCD1234');
ok('whatsapp', whatsappUrl('https://pawtraits.pics/c/ABCD1234', 'Biscuit') === `https://wa.me/?text=${encodeURIComponent(shareMessage('https://pawtraits.pics/c/ABCD1234', 'Biscuit'))}`);
ok('code normalise', normaliseCode(' sara7k3mq2xp ') === 'SARA7K3MQ2XP' && normaliseCode('a b') === null && normaliseCode('') === null && normaliseCode(5) === null && normaliseCode('ab') === null);
ok('storage key unchanged', REFERRAL_STORAGE_KEY === 'referralCode');

// Banner
ok('banner name', bannerText('sarah').headline === 'Sarah gave you 10% off your first Pawtrait');
ok('banner no name', bannerText(null).headline === 'A friend gave you 10% off your first Pawtrait' && bannerText('x1').headline.startsWith('A friend'));
ok('banner sub', bannerText('Sarah').sub === "It comes off at checkout. Pick a design and add your pet's photo.");

// Wording rules: no exclamation marks in our referral copy
ok('no exclamation marks', !Object.values(REFERRAL_COPY).some(v => v.includes('!')));
ok('exact card copy', REFERRAL_COPY.heading === 'Give 10%, get 10%' && REFERRAL_COPY.line === 'Your friend gets 10% off their first Pawtrait. You get 10% of their order as credit.' && REFERRAL_COPY.shareButton === 'Share with a friend' && REFERRAL_COPY.creditLink === 'See my credit');

// Wrapping for the slip
const m = (t: string) => t.length * 4;
ok('wrap', wrapText(m, 'aaa bbb ccc ddd', 30).join('|') === 'aaa bbb|ccc ddd');
ok('panel line fits 2 lines', !!referralPanelLine(m, 330) && referralPanelLine(m, 330)!.length <= 2);
ok('panel line dropped when narrow', referralPanelLine(m, 100) === null);

// QR is a real code: finder pattern top-left, and black-on-white only comes from the renderer
const q = qrMatrix('https://pawtraits.pics/c/ABCD1234');
ok('qr finder', q.isDark(0, 0) && q.isDark(6, 0) && q.isDark(0, 6) && !q.isDark(7, 0) && q.size >= 21);

// Slip PDF: one page per order with or without the panel, and the panel changes the page
async function slips() {
  const order = (n: number, items = 1) => ({
    id: `o${n}`, order_number: `PW-${n}`, created_at: '2026-11-01T10:00:00Z', customer_email: 'a@b.com',
    shipping_first_name: 'Sarah', shipping_last_name: 'Jones', shipping_address_line_1: '1 High St', shipping_city: 'Derby', shipping_postcode: 'de1 1aa', shipping_country: 'GB',
    order_items: Array.from({ length: items }, (_, i) => ({ id: `i${i}`, quantity: 1, image_title: `Pawtrait ${i}`, image_url: null, unit_price: 3500, product_data: { product_type: 'physical_print', size_name: 'Medium', width_cm: 30, height_cm: 45 }, print_image_url: 'x' })),
  });
  const orders = [order(1), order(2, 4), order(3)];
  const refs = new Map([['o1', { code: 'SARA7K3MQ2XP', shareUrl: 'https://pawtraits.pics/c/SARA7K3MQ2XP', shortLink: 'pawtraits.pics/c/SARA7K3MQ2XP' }], ['o2', { code: 'SARA7K3MQ2XP', shareUrl: 'https://pawtraits.pics/c/SARA7K3MQ2XP', shortLink: 'pawtraits.pics/c/SARA7K3MQ2XP' }]]);
  const without = await generatePackingSlips(orders as any[]);
  const withRef = await generatePackingSlips(orders as any[], { referrals: refs });
  const a = await PDFDocument.load(without), b = await PDFDocument.load(withRef);
  ok('slip pages unchanged (pick summary + 3 slips)', a.getPageCount() === 4 && b.getPageCount() === 4, [a.getPageCount(), b.getPageCount()]);
  ok('slip bigger with panel', withRef.length > without.length);
  const single = await generatePackingSlips([orders[2]] as any[], { referrals: refs });
  const plain = await generatePackingSlips([orders[2]] as any[]);
  ok('order without a code: slip identical', Buffer.from(single).length === Buffer.from(plain).length);
  void StandardFonts;
}

// Email block (the partial itself)
import fs from 'fs';
import path from 'path';
const partial = fs.readFileSync(path.join('lib/messaging/templates/partials/referral.html'), 'utf8');
import Handlebars from 'handlebars';
Handlebars.registerPartial('button', fs.readFileSync('lib/messaging/templates/partials/button.html', 'utf8'));
const block = Handlebars.compile(partial);
const html = block({ share_code: 'SARA7K3MQ2XP', share_url: 'https://pawtraits.pics/share/referral/SARA7K3MQ2XP', share_link: 'https://pawtraits.pics/c/SARA7K3MQ2XP', share_short: 'pawtraits.pics/c/SARA7K3MQ2XP' });
ok('email block copy', html.includes('Give 10%, get 10%') && html.includes('Know someone whose pet deserves a Pawtrait? Send them your link: they get 10% off their first, you get 10% of their order as credit.') && html.includes('Share my link') && html.includes('SARA7K3MQ2XP'));
ok('email block absent without code', block({}).trim() === '');
void renderTemplate;

// Helper + gate with a small in-memory database
import { getReferralDetails, referralEmailVars } from '../lib/referrals/share';
function fakeDb(tables: Record<string, any[] | null>) {
  return {
    from(table: string) {
      const rows = tables[table];
      let filters: ((r: any) => boolean)[] = [], patch: any = null;
      const chain: any = {
        select: () => chain,
        eq: (c: string, v: any) => { filters.push(r => r[c] === v); return chain; },
        is: (c: string, v: any) => { filters.push(r => (r[c] ?? null) === v); return chain; },
        ilike: (c: string, v: string) => { filters.push(r => String(r[c]).toLowerCase() === v.replace(/\\(.)/g, '$1').toLowerCase()); return chain; },
        limit: () => chain,
        update: (p: any) => { patch = p; return chain; },
        maybeSingle: async () => {
          if (!rows) return { data: null, error: { message: 'relation does not exist' } };
          const hit = rows.filter(r => filters.every(f => f(r)));
          if (patch) hit.forEach(r => Object.assign(r, patch));
          return { data: patch ? null : hit[0] ?? null, error: null };
        },
        then: (res: any) => { // awaited update without maybeSingle
          if (rows && patch) rows.filter(r => filters.every(f => f(r))).forEach(r => Object.assign(r, patch));
          return Promise.resolve({ data: null, error: null }).then(res);
        },
      };
      return chain;
    },
  } as any;
}
const pref = (over: any = {}) => ({ id: '11111111-1111-1111-1111-111111111111', email: 'sarah@example.com', status: 'subscribed', topics: { new_designs: true, pet_days: true, offers: true }, ...over });
const cust = (over: any = {}) => ({ id: 'c1', first_name: 'sarah', email: 'Sarah@Example.com', personal_referral_code: 'SARA7K3MQ2XP', is_registered: true, ...over });

async function gate() {
  const base = 'https://pawtraits.pics';
  let r = await referralEmailVars(fakeDb({ email_preferences: [pref()], customers: [cust()] }), 'sarah@example.com', base);
  ok('gate: subscribed + code -> block', !!r && r.vars.share_code === 'SARA7K3MQ2XP' && r.vars.share_link === `${base}/c/SARA7K3MQ2XP` && r.vars.share_url === `${base}/share/referral/SARA7K3MQ2XP` && !!r.vars.unsubscribe_url && !!r.metadata.email_headers, r);
  ok('gate: no undefined values', !!r && Object.values(r.vars).every(v => typeof v === 'string' && v.length && !v.includes('undefined')));
  ok('gate: no preferences row -> omitted', (await referralEmailVars(fakeDb({ email_preferences: [], customers: [cust()] }), 'sarah@example.com', base)) === null);
  ok('gate: offers topic off -> omitted', (await referralEmailVars(fakeDb({ email_preferences: [pref({ topics: { new_designs: true, pet_days: true, offers: false } })], customers: [cust()] }), 'sarah@example.com', base)) === null);
  ok('gate: unsubscribed -> omitted', (await referralEmailVars(fakeDb({ email_preferences: [pref({ status: 'unsubscribed' })], customers: [cust()] }), 'sarah@example.com', base)) === null);
  ok('gate: table missing -> omitted (fails closed)', (await referralEmailVars(fakeDb({ email_preferences: null, customers: [cust()] }), 'sarah@example.com', base)) === null);
  ok('gate: not registered -> omitted', (await referralEmailVars(fakeDb({ email_preferences: [pref()], customers: [cust({ is_registered: false })] }), 'sarah@example.com', base)) === null);
  ok('gate: no customer -> omitted', (await referralEmailVars(fakeDb({ email_preferences: [pref()], customers: [] }), 'sarah@example.com', base)) === null);
  ok('gate: bad email -> omitted', (await referralEmailVars(fakeDb({ email_preferences: [pref()], customers: [cust()] }), 'nope', base)) === null);
  // Read-only callers never write a code; email callers make one for a registered customer who has none
  const db = fakeDb({ email_preferences: [pref()], customers: [cust({ personal_referral_code: null })] });
  ok('details: no code, create off -> null', (await getReferralDetails(db, 'sarah@example.com')) === null);
  const made = await referralEmailVars(db, 'sarah@example.com', base);
  ok('details: no code, email path creates one', !!made && /^SARA[A-Z0-9]{8}$/.test(made.vars.share_code), made);
  const d = await getReferralDetails(fakeDb({ customers: [cust({ first_name: '<b>Sa</b>' })] }), 'sarah@example.com', { qr: true });
  ok('details: unsafe name -> null firstName; qr is black on white svg', !!d && d.firstName === null && !!d.qrSvg && /#000000/i.test(d.qrSvg) && /#ffffff/i.test(d.qrSvg), d?.qrSvg?.slice(0, 200));
}

slips().then(gate).then(() => {
  console.log(fail ? `${fail} failed, ${pass} passed` : `${pass} tests passed`);
  process.exit(fail ? 1 : 0);
});
