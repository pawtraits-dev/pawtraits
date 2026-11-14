// Run: NEXT_PUBLIC_SUPABASE_URL=http://localhost:1 SUPABASE_SERVICE_ROLE_KEY=x CLOUDINARY_CLOUD_NAME=demo CLOUDINARY_API_KEY=x CLOUDINARY_API_SECRET=x npx tsx scripts/test-preview-emails.ts   (no network)
import { LINK_DAYS, PREVIEW_LIMITS, appendSend, attributionToRestore, limitProblem, marketingStep, previewFirstName, previewUrl, sendsInLastDay, signPreviewToken, verifyPreviewToken } from '../lib/previews/email-link';
import { openPreviewLink } from '../lib/previews/server';
import { getPreferences, subscribe, unsubscribe, maskEmail } from '../lib/marketing/preferences';
import { ATTRIBUTION_MAX_AGE_S, decodeAttribution, encodeAttribution } from '../lib/qr/attribution';
import { PREVIEW_COPY, PREVIEW_EMAIL } from '../lib/previews/copy';

let pass = 0, fail = 0;
const ok = (name: string, cond: boolean, extra?: unknown) => { if (cond) pass++; else { fail++; console.log('FAIL', name, extra ?? ''); } };
const DAY = 86_400_000;
const id = '0b6f1c2e-3d4a-4e5f-8a9b-1c2d3e4f5a6b';

(async () => {
  // Tokens
  const now = Date.UTC(2026, 10, 14);
  const t = signPreviewToken(id, now);
  ok('token verifies and carries the request id', JSON.stringify(verifyPreviewToken(t, now + 1000)) === JSON.stringify({ ok: true, requestId: id }));
  ok('token carries no address', !/@/.test(t) && t.startsWith(id));
  ok('valid for 30 days, then expired', verifyPreviewToken(t, now + (LINK_DAYS - 1) * DAY).ok && (verifyPreviewToken(t, now + (LINK_DAYS + 1) * DAY) as any).reason === 'expired');
  const [a, exp, sig] = t.split('.');
  ok('tampered signature, expiry, id or shape is bad', (verifyPreviewToken(`${a}.${exp}.${sig}x`, now) as any).reason === 'bad'
    && (verifyPreviewToken(`${a}.${(parseInt(exp, 36) + 1e9).toString(36)}.${sig}`, now) as any).reason === 'bad'
    && (verifyPreviewToken(`1b6f1c2e-3d4a-4e5f-8a9b-1c2d3e4f5a6b.${exp}.${sig}`, now) as any).reason === 'bad'
    && (verifyPreviewToken('rubbish', now) as any).reason === 'bad' && (verifyPreviewToken(undefined, now) as any).reason === 'bad' && (verifyPreviewToken(`${a}..${sig}`, now) as any).reason === 'bad');
  ok('link shape', previewUrl('https://pawtraits.pics/', id, now) === `https://pawtraits.pics/pv/${t}`);

  // Names
  ok('first name: first word, letters only, capitalised', previewFirstName('biscuit & luna') === 'Biscuit' && previewFirstName("O'Malley") === 'OMalley' && previewFirstName('Zoë') === 'Zoë');
  ok('first name: nothing left = null; capped at 16', previewFirstName('123 !!') === null && previewFirstName(null) === null && previewFirstName('a'.repeat(30))!.length === 16);
  ok('subject and body wording', PREVIEW_EMAIL.subject('Biscuit') === "Biscuit's Pawtrait preview is ready" && PREVIEW_EMAIL.subject(null) === 'Your Pawtrait preview is ready'
    && PREVIEW_EMAIL.body('Biscuit') === "Pawcasso has painted Biscuit in. Have another look, pick a size, and it's yours." && PREVIEW_EMAIL.body(null).startsWith('Pawcasso has painted your pet in.'));
  ok('card wording and no exclamation marks', PREVIEW_COPY.sentLine('s•••@gmail.com') === "We've sent your preview to s•••@gmail.com. Open it on any device to carry on." && PREVIEW_COPY.signedInSent('s•••@gmail.com') === 'Sent to s•••@gmail.com.'
    && ![PREVIEW_COPY.heading, PREVIEW_COPY.line, PREVIEW_COPY.errBad, PREVIEW_COPY.errLimit, PREVIEW_COPY.errOther, PREVIEW_EMAIL.marketingLine, PREVIEW_EMAIL.footerNote].some(s => s.includes('!')));
  ok('masking', maskEmail('steve@gmail.com') === 's•••@gmail.com');

  // Limits
  ok('limits are 3 / 3 / 5', PREVIEW_LIMITS.perPreview === 3 && PREVIEW_LIMITS.addressesPerGuestPerDay === 3 && PREVIEW_LIMITS.perAddressPerDay === 5);
  const base = { email: 'a@b.co', sendsForPreview: 0, guestAddressesToday: [] as string[], sendsToAddressToday: 0 };
  ok('fresh: ok', limitProblem(base) === null);
  ok('preview: 2 sends ok, 3 sends refused', limitProblem({ ...base, sendsForPreview: 2 }) === null && limitProblem({ ...base, sendsForPreview: 3 }) === 'preview');
  ok('guest: 2 other addresses ok, 3 other addresses refused', limitProblem({ ...base, guestAddressesToday: ['x@y.co', 'z@y.co'] }) === null && limitProblem({ ...base, guestAddressesToday: ['x@y.co', 'z@y.co', 'w@y.co'] }) === 'addresses');
  ok('guest: an address already used today is not a new one', limitProblem({ ...base, guestAddressesToday: ['x@y.co', 'z@y.co', 'a@b.co'] }) === null);
  ok('address: 4 today ok, 5 refused', limitProblem({ ...base, sendsToAddressToday: 4 }) === null && limitProblem({ ...base, sendsToAddressToday: 5 }) === 'address');
  const times = [new Date(now - 2 * DAY).toISOString(), new Date(now - DAY / 2).toISOString(), new Date(now - 60_000).toISOString()];
  ok('sends in the last 24 hours', sendsInLastDay(times, now) === 2 && sendsInLastDay(null, now) === 0 && sendsInLastDay(['nonsense'], now) === 0);
  ok('send log keeps the last 10', appendSend(Array.from({ length: 12 }, (_, i) => new Date(now - i * 1000).toISOString()), now).length === 10 && appendSend(null, now).length === 1);

  // Pending marketing tick rules
  const pend = { marketing_ticked: true, marketing_confirmed_at: null };
  ok('unticked: nothing', marketingStep({ marketing_ticked: false, marketing_confirmed_at: null }, null) === 'none');
  ok('ticked, address unknown: subscribe on open', marketingStep(pend, null) === 'subscribe');
  ok('ticked, already confirmed: nothing (once)', marketingStep({ marketing_ticked: true, marketing_confirmed_at: 'x' }, null) === 'none');
  ok('ticked, already subscribed: leave it', marketingStep(pend, 'subscribed') === 'already');
  ok('ticked, UNSUBSCRIBED: never overridden', marketingStep(pend, 'unsubscribed') === 'blocked_unsubscribed');

  // Stall attribution carry-over
  const qr = { scanId: 's1', imageId: 'i', locationId: 'l1', size: 'M', ts: now - 3 * DAY };
  const r1 = attributionToRestore(qr, null, now);
  ok('restored on a device with none, with its ORIGINAL timestamp and only the time left', r1?.attribution.ts === qr.ts && r1.maxAgeS === ATTRIBUTION_MAX_AGE_S - 3 * 86400);
  ok('the restored cookie still expires 30 days after the original scan', decodeAttribution(encodeAttribution(r1!.attribution))?.scanId === 's1' && decodeAttribution(encodeAttribution({ ...qr, ts: Date.now() - 31 * DAY })) === null);
  ok('not restored when this device has a newer or equal scan', attributionToRestore(qr, { ...qr, scanId: 's2', ts: now - DAY }, now) === null && attributionToRestore(qr, qr, now) === null);
  ok('restored over an OLDER scan', attributionToRestore(qr, { ...qr, scanId: 's0', ts: now - 9 * DAY }, now) !== null);
  ok('not restored once the 30 days are up, or with nothing stored', attributionToRestore({ ...qr, ts: now - 31 * DAY }, null, now) === null && attributionToRestore(null, null, now) === null);

  // openPreviewLink with a small in-memory database
  const mk = (over: any = {}) => {
    const tables: Record<string, any[]> = {
      preview_email_requests: [{ id, custom_image_id: 'img1', email: 'owner@x.co', customer_id: null, marketing_ticked: true, marketing_confirmed_at: null, opened_at: null, open_count: 0, qr_attribution: qr, ...over.req }],
      customer_custom_images: [{ id: 'img1', guest_session_id: 'phone', customer_email: null, ...over.img }],
      email_preferences: over.prefs ?? [], email_preference_events: [], customers: [],
    };
    const from = (table: string) => {
      const rows = tables[table] ?? (tables[table] = []);
      let filters: ((r: any) => boolean)[] = [], op = 'select', patch: any = null, single = false;
      const run = () => { const hit = rows.filter(r => filters.every(f => f(r))); if (op === 'update') hit.forEach(r => Object.assign(r, patch)); return hit; };
      const chain: any = {
        select: () => chain, eq: (c: string, v: any) => { filters.push(r => r[c] === v); return chain; }, in: (c: string, v: any[]) => { filters.push(r => v.includes(r[c])); return chain; },
        ilike: (c: string, v: string) => { filters.push(r => String(r[c]).toLowerCase() === v.toLowerCase()); return chain; }, limit: () => chain,
        update: (p: any) => { op = 'update'; patch = p; return chain; }, insert: (o: any) => { rows.push({ id: `e${rows.length}`, ...o }); return Promise.resolve({ error: null }); },
        upsert: (o: any, opts: any) => { const k = opts?.onConflict ?? 'id'; const ex = rows.find(r => r[k] === o[k]); if (ex) Object.assign(ex, o); else rows.push({ id: `p${rows.length}`, ...o }); filters = [r => r[k] === o[k]]; op = 'select'; return chain; },
        single: () => { single = true; return chain; },
        maybeSingle: async () => ({ data: run()[0] ?? null, error: null }),
        then: (f: any) => f(single ? { data: run()[0] ?? null, error: null } : { data: run(), error: null }),
      };
      return chain;
    };
    return { db: { from } as any, tables };
  };

  let { db, tables } = mk();
  let o = await openPreviewLink(db, id, { guestId: 'laptop' });
  ok('second device: the preview now belongs to this browser\'s guest session', o.ok && tables.customer_custom_images[0].guest_session_id === 'laptop' && (o as any).imageId === 'img1');
  ok('the address is recorded on the preview only now it has been proven (and only if it had none)', tables.customer_custom_images[0].customer_email === 'owner@x.co');
  ok('the open is recorded', !!tables.preview_email_requests[0].opened_at && tables.preview_email_requests[0].open_count === 1);
  ok('the pending tick is confirmed: subscribed as explicit consent from preview_email', (await getPreferences(db, 'owner@x.co'))?.status === 'subscribed' && (await getPreferences(db, 'owner@x.co'))?.basis === 'consent' && (await getPreferences(db, 'owner@x.co'))?.consent_source === 'preview_email' && !!tables.preview_email_requests[0].marketing_confirmed_at);
  const before = JSON.stringify(tables.email_preference_events);
  await openPreviewLink(db, id, { guestId: 'laptop' });
  ok('opening it again is safe: no second subscription', JSON.stringify(tables.email_preference_events) === before && tables.preview_email_requests[0].open_count === 2);
  ok('the stored attribution is handed back for the cookie', (o as any).qr?.scanId === 's1');

  ({ db, tables } = mk({ img: { customer_email: 'maker@x.co' } }));
  await openPreviewLink(db, id, { guestId: 'phone' });
  ok('an existing owner address is never overwritten; same device changes nothing', tables.customer_custom_images[0].customer_email === 'maker@x.co' && tables.customer_custom_images[0].guest_session_id === 'phone');

  ({ db, tables } = mk({ req: { marketing_ticked: false } }));
  await openPreviewLink(db, id, { guestId: 'laptop' });
  ok('unticked: nobody is subscribed and no row is made', tables.email_preferences.length === 0 && tables.email_preference_events.length === 0);

  ({ db, tables } = mk());
  await unsubscribe(db, { email: 'owner@x.co', source: 'email_link' });
  await openPreviewLink(db, id, { guestId: 'laptop' });
  ok('an unsubscribed address stays unsubscribed even with the box ticked', (await getPreferences(db, 'owner@x.co'))?.status === 'unsubscribed' && !tables.preview_email_requests[0].marketing_confirmed_at);

  ({ db, tables } = mk());
  ok('unknown request id: not ok', !(await openPreviewLink(db, '1b6f1c2e-3d4a-4e5f-8a9b-1c2d3e4f5a6b', { guestId: 'x' })).ok);

  console.log(fail ? `${fail} failed, ${pass} passed` : `${pass} passed`);
  process.exit(fail ? 1 : 0);
})();
