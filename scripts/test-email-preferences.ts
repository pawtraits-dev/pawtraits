// Run: npx tsx scripts/test-email-preferences.ts   (no network, no database: a small in-memory fake)
import {
  ALL_TOPICS_ON, allTopicsOff, canEmail, getPreferences, listUnsubscribeHeaders, marketingEmailExtras, maskEmail, normaliseEmail, normaliseTopics,
  preferencesUrl, purchaseOutcome, recordTick, setTopics, signPreference, statusForTopics, subscribe, subscribeFromPurchase, tickIsStale, unsubscribe, unsubscribeUrl, verifyPreferenceToken,
} from '../lib/marketing/preferences';
import { marketingState } from '../lib/marketing/admin';
import { BASIS_WORDS, CHECKOUT_LINE, CHECKOUT_OPT_OUT_LABEL, CHECKOUT_WORDING, CONSENT_LABEL, CONSENT_VERSION, EMAIL_TOPICS } from '../lib/marketing/consent-copy';
import { badLinkPage, confirmPage, donePage, escapeHtml } from '../lib/marketing/pages';

let pass = 0, fail = 0;
const ok = (name: string, cond: boolean, extra?: unknown) => { if (cond) pass++; else { fail++; console.log('FAIL', name, extra ?? ''); } };

// In-memory database: email_preferences, email_preference_events, customers
function fakeDb(customers: any[] = []) {
  const tables: Record<string, any[]> = { email_preferences: [], email_preference_events: [], customers };
  let n = 0;
  const from = (table: string) => {
    const rows = tables[table] ?? (tables[table] = []);
    let filters: ((r: any) => boolean)[] = [], op: 'select' | 'update' | 'upsert' | 'insert' = 'select', patch: any = null, single = false;
    const run = () => {
      const hit = rows.filter(r => filters.every(f => f(r)));
      if (op === 'update') { hit.forEach(r => Object.assign(r, patch)); return hit; }
      return hit;
    };
    const chain: any = {
      select: () => chain,
      eq: (c: string, v: any) => { filters.push(r => r[c] === v); return chain; },
      in: (c: string, v: any[]) => { filters.push(r => v.includes(r[c])); return chain; },
      ilike: (c: string, v: string) => { const re = new RegExp('^' + v.replace(/\\(.)/g, '$1').replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i'); filters.push(r => re.test(String(r[c]))); return chain; },
      limit: () => chain,
      update: (p: any) => { op = 'update'; patch = p; return chain; },
      insert: (o: any) => { rows.push({ id: `id${++n}`, created_at: new Date().toISOString(), ...o }); return Promise.resolve({ error: null }); },
      upsert: (o: any, opts: any) => {
        const key = opts?.onConflict ?? 'id';
        const ex = rows.find(r => r[key] === o[key]);
        if (ex) Object.assign(ex, o); else rows.push({ id: `p${++n}`, created_at: new Date().toISOString(), ...o });
        filters = [r => r[key] === o[key]]; op = 'select';
        return chain;
      },
      single: () => { single = true; return chain; },
      maybeSingle: async () => ({ data: run()[0] ?? null, error: null }),
      then: (f: any) => f(single ? { data: run()[0] ?? null, error: null } : { data: run(), error: null }),
    };
    return chain;
  };
  return { db: { from } as any, tables };
}
const events = (t: any, action?: string) => t.email_preference_events.filter((e: any) => !action || e.action === action);

(async () => {
  // Pure helpers
  ok('email: trimmed and lower-cased', normaliseEmail('  Steve@GMail.COM ') === 'steve@gmail.com');
  ok('email: rubbish is null', normaliseEmail('nope') === null && normaliseEmail(42) === null && normaliseEmail('a b@c.d') === null);
  ok('topics: only booleans count', JSON.stringify(normaliseTopics({ new_designs: true, pet_days: 'yes', offers: false, extra: true })) === JSON.stringify({ new_designs: true, pet_days: false, offers: false }));
  ok('topics: fallback for missing keys', normaliseTopics(null, true).offers === true);
  ok('all off = unsubscribed, otherwise subscribed', statusForTopics(normaliseTopics({})) === 'unsubscribed' && statusForTopics({ ...normaliseTopics({}), offers: true }) === 'subscribed' && allTopicsOff({ new_designs: false, pet_days: false, offers: false }));
  ok('masked address', maskEmail('steve@gmail.com') === 's•••@gmail.com' && maskEmail('x') === '•••');

  // Signed links
  const id = '0b6f1c2e-3d4a-4e5f-8a9b-1c2d3e4f5a6b';
  const t = signPreference(id);
  ok('token verifies', verifyPreferenceToken(id, t));
  ok('wrong token, other id, missing, not a uuid', !verifyPreferenceToken(id, t + 'x') && !verifyPreferenceToken('1b6f1c2e-3d4a-4e5f-8a9b-1c2d3e4f5a6b', t) && !verifyPreferenceToken(id, undefined) && !verifyPreferenceToken('abc', t) && !verifyPreferenceToken(undefined, t));
  const link = preferencesUrl('https://pawtraits.pics/', id), un = unsubscribeUrl('https://pawtraits.pics', id);
  ok('links carry the row id and signature, never an address', link === `https://pawtraits.pics/email-preferences?p=${id}&t=${t}` && un === `https://pawtraits.pics/api/public/email-preferences/unsubscribe?p=${id}&t=${t}` && !/@/.test(link + un));
  const h = listUnsubscribeHeaders(un);
  ok('RFC 8058 headers', h['List-Unsubscribe'] === `<${un}>` && h['List-Unsubscribe-Post'] === 'List-Unsubscribe=One-Click');

  // Wording lives in one place
  ok('wording: exact strings', CONSENT_LABEL === 'Yes please: send me new designs, a birthday treat for my pet and the odd offer. Stop any time.'
    && CHECKOUT_LINE === 'We\'ll send you new designs, a birthday treat for your pet and the odd offer. Stop any time.'
    && CHECKOUT_OPT_OUT_LABEL === 'No thanks, just my order emails' && CHECKOUT_WORDING.includes(CHECKOUT_LINE) && CHECKOUT_WORDING.includes(CHECKOUT_OPT_OUT_LABEL)
    && EMAIL_TOPICS.map(x => x.title).join('|') === 'Fresh off the easel|Birthday and star-sign treats|Offers and news');
  ok('no exclamation marks in the copy', ![CONSENT_LABEL, CHECKOUT_LINE, CHECKOUT_OPT_OUT_LABEL, ...EMAIL_TOPICS.map(x => x.description)].some(s => s.includes('!')));

  // canEmail: the gate
  let { db, tables } = fakeDb();
  ok('never asked: no', (await canEmail(db, 'a@b.co', 'offers')) === false);
  ok('bad address: no', (await canEmail(db, 'nonsense', 'offers')) === false);
  await subscribe(db, { email: 'A@B.co', source: 'quiz_save' });
  ok('subscribed, any case: yes for all three topics', (await canEmail(db, 'a@b.CO', 'offers')) && (await canEmail(db, 'a@b.co', 'new_designs')) && (await canEmail(db, 'a@b.co', 'pet_days')));
  const row = await getPreferences(db, 'a@b.co');
  ok('consent recorded: basis, source, wording, version, date', row?.basis === 'consent' && row.consent_source === 'quiz_save' && row.consent_wording === CONSENT_LABEL && row.consent_version === CONSENT_VERSION && !!row.consented_at && row.email === 'a@b.co');
  ok('a subscribed event with the wording', events(tables, 'subscribed').length === 1 && events(tables, 'subscribed')[0].wording === CONSENT_LABEL && events(tables, 'subscribed')[0].basis === 'consent');
  await setTopics(db, { email: 'a@b.co', topics: { new_designs: true, pet_days: false, offers: false }, source: 'preferences_page' });
  ok('one topic on: only that one', (await canEmail(db, 'a@b.co', 'new_designs')) && !(await canEmail(db, 'a@b.co', 'offers')) && !(await canEmail(db, 'a@b.co', 'pet_days')));
  ok('topics_changed event', events(tables, 'topics_changed').length === 1);
  await setTopics(db, { email: 'a@b.co', topics: { new_designs: true, pet_days: false, offers: false }, source: 'preferences_page' });
  ok('saving the same switches adds no event', events(tables, 'topics_changed').length === 1);
  await setTopics(db, { email: 'a@b.co', topics: {}, source: 'preferences_page' });
  ok('all off = unsubscribed, no email', (await getPreferences(db, 'a@b.co'))?.status === 'unsubscribed' && !(await canEmail(db, 'a@b.co', 'new_designs')));
  const broken = { from: () => { throw new Error('db down'); } } as any;
  ok('a failing database fails closed', (await canEmail(broken, 'a@b.co', 'offers')) === false);

  // Unsubscribing: the suppression list
  ({ db, tables } = fakeDb());
  await unsubscribe(db, { email: 'Nobody@x.co', source: 'one_click' });
  const sup = await getPreferences(db, 'nobody@x.co');
  ok('unsubscribe creates the row (the suppression list)', sup?.status === 'unsubscribed' && sup.unsubscribe_source === 'one_click' && !!sup.unsubscribed_at && !(await canEmail(db, 'nobody@x.co', 'offers')));
  ok('unsubscribed event', events(tables, 'unsubscribed').length === 1 && events(tables, 'unsubscribed')[0].source === 'one_click');
  await unsubscribe(db, { email: 'nobody@x.co', source: 'email_link' });
  ok('unsubscribing twice stays one row', tables.email_preferences.length === 1);

  // THE RULE: a purchase never re-subscribes an unsubscribed address
  ok('purchaseOutcome: no row, not opted out → subscribed', purchaseOutcome(null, false) === 'subscribed');
  ok('purchaseOutcome: unsubscribed, not opted out → left unsubscribed', purchaseOutcome({ status: 'unsubscribed' }, false) === 'left_unsubscribed');
  ok('purchaseOutcome: subscribed → already subscribed', purchaseOutcome({ status: 'subscribed' }, false) === 'already_subscribed');
  ok('purchaseOutcome: "No thanks" always declined', purchaseOutcome(null, true) === 'declined' && purchaseOutcome({ status: 'subscribed' }, true) === 'declined' && purchaseOutcome({ status: 'unsubscribed' }, true) === 'declined');

  ({ db, tables } = fakeDb([{ id: 'c1', email: 'Buyer@Shop.co', marketing_consent: false }]));
  ok('a buyer who did not say no is subscribed (soft opt-in, all topics)', (await subscribeFromPurchase(db, { email: 'buyer@shop.co', optedOut: false })) === 'subscribed' && (await canEmail(db, 'buyer@shop.co', 'pet_days')));
  const br = await getPreferences(db, 'buyer@shop.co');
  ok('basis soft_opt_in, source checkout, wording is the line plus the box label, linked to the customer', br?.basis === 'soft_opt_in' && br.consent_source === 'checkout' && br.consent_wording === CHECKOUT_WORDING && br.customer_id === 'c1');
  ok('the event records the basis', events(tables, 'subscribed')[0].basis === 'soft_opt_in');
  ok('customers.marketing_consent kept in step', tables.customers[0].marketing_consent === true);
  await setTopics(db, { email: 'buyer@shop.co', topics: { new_designs: false, pet_days: true, offers: false }, source: 'account' });
  ok('a second purchase leaves a subscribed buyer alone (their topics stay)', (await subscribeFromPurchase(db, { email: 'buyer@shop.co', optedOut: false })) === 'already_subscribed' && !(await canEmail(db, 'buyer@shop.co', 'offers')) && (await canEmail(db, 'buyer@shop.co', 'pet_days')) && events(tables, 'subscribed').length === 1);

  await unsubscribe(db, { email: 'buyer@shop.co', source: 'email_link' });
  ok('unsubscribed buyer, next checkout without "No thanks": STILL unsubscribed', (await subscribeFromPurchase(db, { email: 'Buyer@Shop.co', optedOut: false })) === 'left_unsubscribed' && (await getPreferences(db, 'buyer@shop.co'))?.status === 'unsubscribed' && !(await canEmail(db, 'buyer@shop.co', 'new_designs')));
  ok('…and nothing was written', events(tables, 'subscribed').length === 1 && tables.customers[0].marketing_consent === false);
  ok('a deliberate "Yes please" (preferences page) does re-subscribe, as consent', (await setTopics(db, { email: 'buyer@shop.co', topics: ALL_TOPICS_ON, source: 'preferences_page' }))?.status === 'subscribed' && (await getPreferences(db, 'buyer@shop.co'))?.basis === 'consent' && (await canEmail(db, 'buyer@shop.co', 'offers')));

  ({ db, tables } = fakeDb());
  ok('"No thanks" with no row: a declined event, no row created, no subscription', (await subscribeFromPurchase(db, { email: 'x@y.co', optedOut: true })) === 'declined' && tables.email_preferences.length === 0 && events(tables, 'declined').length === 1 && events(tables, 'declined')[0].source === 'checkout' && !(await canEmail(db, 'x@y.co', 'offers')));
  await subscribe(db, { email: 'x@y.co', source: 'quiz_save' });
  await subscribeFromPurchase(db, { email: 'x@y.co', optedOut: true });
  ok('"No thanks" does NOT unsubscribe someone already subscribed', (await getPreferences(db, 'x@y.co'))?.status === 'subscribed' && events(tables, 'declined').length === 2 && events(tables, 'unsubscribed').length === 0);
  await unsubscribe(db, { email: 'x@y.co', source: 'email_link' });
  await subscribeFromPurchase(db, { email: 'x@y.co', optedOut: true });
  ok('"No thanks" on an unsubscribed address leaves it unsubscribed', (await getPreferences(db, 'x@y.co'))?.status === 'unsubscribed');
  ok('no email address: nothing', (await subscribeFromPurchase(db, { email: null, optedOut: false })) === null);

  // Ticks (people who have not bought)
  ({ db, tables } = fakeDb());
  ok('unticked: nothing at all', (await recordTick(db, { ticked: false, email: 'q@z.co', source: 'quiz_save' })) === false && tables.email_preferences.length === 0 && tables.email_preference_events.length === 0);
  await unsubscribe(db, { email: 'q@z.co', source: 'email_link' });
  const before = JSON.stringify(tables);
  await recordTick(db, { ticked: false, email: 'q@z.co', source: 'quiz_save' });
  ok('unticked never touches an unsubscribed address', JSON.stringify(tables) === before && (await getPreferences(db, 'q@z.co'))?.status === 'unsubscribed');
  ok('ticked: subscribed with basis consent', (await recordTick(db, { ticked: true, email: 'Q@z.co', source: 'quiz_save' })) === true && (await canEmail(db, 'q@z.co', 'offers')) && (await getPreferences(db, 'q@z.co'))?.basis === 'consent');
  ok('stale tick (unsubscribed after the box was ticked)', tickIsStale({ status: 'unsubscribed', unsubscribed_at: '2026-11-14T12:00:00Z' }, '2026-11-14T10:00:00Z') && !tickIsStale({ status: 'unsubscribed', unsubscribed_at: '2026-11-14T09:00:00Z' }, '2026-11-14T10:00:00Z') && !tickIsStale(null, '2026-11-14T10:00:00Z') && !tickIsStale({ status: 'subscribed', unsubscribed_at: null }, '2026-11-14T10:00:00Z'));
  await unsubscribe(db, { email: 'q@z.co', source: 'email_link' });
  ok('a replayed tick older than the unsubscribe is ignored', (await recordTick(db, { ticked: true, email: 'q@z.co', source: 'checkout', at: '2020-01-01T00:00:00Z' })) === false && (await getPreferences(db, 'q@z.co'))?.status === 'unsubscribed');

  // Links for a future marketing send
  ({ db, tables } = fakeDb());
  ok('no row: no links (rows are never created just to make a link)', (await marketingEmailExtras(db, 'https://x.co', 'n@n.co')) === null && tables.email_preferences.length === 0);
  const s = await subscribe(db, { email: 'n@n.co', source: 'quiz_save' });
  const ex = await marketingEmailExtras(db, 'https://x.co', 'N@n.co');
  ok('extras for a subscribed address', ex?.unsubscribe_url === unsubscribeUrl('https://x.co', s.id) && ex?.preferences_url === preferencesUrl('https://x.co', s.id) && ex?.headers['List-Unsubscribe-Post'] === 'List-Unsubscribe=One-Click');

  // Admin view
  ok('admin: subscribed with basis words', marketingState({ status: 'subscribed', basis: 'soft_opt_in', consent_source: 'checkout', consented_at: 'd', topics: ALL_TOPICS_ON }).state === 'subscribed' && BASIS_WORDS.soft_opt_in === 'Bought from us (didn\'t say no)' && BASIS_WORDS.consent === 'Ticked yes');
  ok('admin: unsubscribed, never asked, legacy flag', marketingState({ status: 'unsubscribed', unsubscribe_source: 'admin', unsubscribed_at: 'd' }).state === 'unsubscribed' && marketingState(null).state === 'never' && marketingState(null, true).subscribed === true && marketingState(null, false).subscribed === false);

  // Unsubscribe pages
  const post = 'https://x.co/api/public/email-preferences/unsubscribe?p=a&t=b';
  ok('GET confirm page: a form that POSTs, the exact words, a way to pick and choose', /<form method="post" action="[^"]+"/.test(confirmPage(post, 'https://x.co/p')) && confirmPage(post, 'https://x.co/p').includes('Stop all emails?') && confirmPage(post, 'https://x.co/p').includes('Yes, stop all emails') && confirmPage(post, 'https://x.co/p').includes('I&#39;d rather pick and choose'));
  ok('done page words', donePage('https://x.co/p').includes('Done. We&#39;ll sit and stay quiet.') && donePage('https://x.co/p').includes('Changed your mind? Pick what you&#39;d like instead'));
  ok('bad link page', badLinkPage().includes('This link has gone walkies') && badLinkPage().includes('support@pawtraits.pics'));
  ok('html is escaped', escapeHtml('<a href="x">&\'') === '&lt;a href=&quot;x&quot;&gt;&amp;&#39;' && !confirmPage('https://x.co/?a="><script>', 'x').includes('"><script>'));

  console.log(fail ? `${fail} failed, ${pass} passed` : `${pass} passed`);
  process.exit(fail ? 1 : 0);
})();
