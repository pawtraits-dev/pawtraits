// Run: NEXT_PUBLIC_SUPABASE_URL=https://x.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=x SUPABASE_SERVICE_ROLE_KEY=x npx tsx scripts/test-meta-events.ts   (no network)
import { createHash } from 'crypto';
import { NextRequest } from 'next/server';
import { buildMetaEvent } from '../lib/tracking/meta-capi';
import { metaClientFromRequest } from '../lib/tracking/meta-request';

let pass = 0, fail = 0;
const ok = (name: string, cond: boolean, extra?: unknown) => { if (cond) pass++; else { fail++; console.log('FAIL', name, extra ?? ''); } };
const sha = (v: string) => createHash('sha256').update(v).digest('hex');

delete process.env.META_CAPI_TEST_EVENT_CODE;

// Hashing: trim + lower-case first
const e = buildMetaEvent({ name: 'Lead', eventId: 'lead_1', eventTimeS: 1700000000, email: '  Jane.Doe@Example.COM ', postcode: 'NW6 1AB', phone: '+44 7700 900123', country: 'GB' });
const d = e.data[0];
ok('email hashed from trimmed lower-case', JSON.stringify(d.user_data.em) === JSON.stringify([sha('jane.doe@example.com')]), d.user_data.em);
ok('postcode hashed without spaces', JSON.stringify(d.user_data.zp) === JSON.stringify([sha('nw61ab')]));
ok('phone hashed digits only', JSON.stringify(d.user_data.ph) === JSON.stringify([sha('447700900123')]));
ok('country hashed lower-case', JSON.stringify(d.user_data.country) === JSON.stringify([sha('gb')]));
ok('name, id, time, source', d.event_name === 'Lead' && d.event_id === 'lead_1' && d.event_time === 1700000000 && d.action_source === 'website');
ok('no test_event_code by default', !('test_event_code' in e));
process.env.META_CAPI_TEST_EVENT_CODE = 'TEST123';
ok('test_event_code when set', (buildMetaEvent({ name: 'Lead', eventId: 'x' }) as any).test_event_code === 'TEST123');
delete process.env.META_CAPI_TEST_EVENT_CODE;

// Missing fields are undefined, never empty strings
const bare = buildMetaEvent({ name: 'CustomizeProduct', eventId: 'preview_1', email: '', firstName: null, fbp: null, clientIp: undefined, userAgent: null, sourceUrl: null, customData: { content_ids: ['c1'], content_type: 'product' } }).data[0];
const u = bare.user_data as Record<string, unknown>;
ok('omitted user_data fields are undefined', ['em', 'ph', 'fn', 'ln', 'zp', 'country', 'fbp', 'fbc', 'client_ip_address', 'client_user_agent'].every(k => u[k] === undefined), u);
ok('no empty strings anywhere', !JSON.stringify(bare).includes('""'));
ok('event_source_url undefined when missing', bare.event_source_url === undefined);
ok('custom_data passed through', JSON.stringify(bare.custom_data) === JSON.stringify({ content_ids: ['c1'], content_type: 'product' }));
ok('fbp/fbc/ip/ua kept as given', (() => { const x = buildMetaEvent({ name: 'Lead', eventId: 'a', fbp: 'fb.1.2.3', fbc: 'fb.1.2.abc', clientIp: '1.2.3.4', userAgent: 'UA', sourceUrl: 'https://s/x' }).data[0]; return x.user_data.fbp === 'fb.1.2.3' && x.user_data.fbc === 'fb.1.2.abc' && x.user_data.client_ip_address === '1.2.3.4' && x.user_data.client_user_agent === 'UA' && x.event_source_url === 'https://s/x'; })());

// Purchase body shape (sendMetaPurchase builds exactly this)
const sent: any[] = [];
const realFetch = globalThis.fetch;
process.env.NEXT_PUBLIC_META_PIXEL_ID = '123'; process.env.META_CAPI_ACCESS_TOKEN = 'tok';
globalThis.fetch = (async (url: any, init: any) => { sent.push({ url: String(url), body: JSON.parse(init.body) }); return new Response('{}', { status: 200 }); }) as any;

(async () => {
  const { sendMetaPurchase } = await import('../lib/tracking/meta-capi');
  await sendMetaPurchase({ eventId: 'pi_1', eventTimeS: 1700000000, email: 'A@b.co', valuePounds: 42.5, contentIds: ['i1', 'i2'], sourceUrl: 'https://s/' });
  globalThis.fetch = realFetch;
  const p = sent[0]?.body?.data?.[0];
  ok('purchase posts to the events endpoint (stubbed fetch)', sent.length === 1 && sent[0].url.startsWith('https://graph.facebook.com/v21.0/123/events?access_token='));
  ok('purchase custom_data unchanged', JSON.stringify(p?.custom_data) === JSON.stringify({ currency: 'GBP', value: 42.5, content_ids: ['i1', 'i2'], content_type: 'product' }), p?.custom_data);
  ok('purchase name / id / email hash', p?.event_name === 'Purchase' && p?.event_id === 'pi_1' && p?.user_data?.em?.[0] === sha('a@b.co'));

  // metaClientFromRequest
  const req = (consent: string | undefined) => new NextRequest('https://example.com/api/x', {
    headers: {
      ...(consent ? { cookie: `pt_consent=${consent}; _fbp=fb.1.1.1; _fbc=fb.1.1.abc` } : { cookie: '_fbp=fb.1.1.1' }),
      'x-forwarded-for': '203.0.113.9, 10.0.0.1', 'user-agent': 'TestUA/1', referer: 'https://example.com/customise/abc',
    },
  });
  ok('no consent cookie: null', metaClientFromRequest(req(undefined)) === null);
  ok('marketing denied (v1.a1.m0): null', metaClientFromRequest(req('v1.a1.m0')) === null);
  ok('garbage consent: null', metaClientFromRequest(req('nonsense')) === null);
  const c = metaClientFromRequest(req('v1.a0.m1'));
  ok('marketing granted (v1.a0.m1): data', !!c && c.fbp === 'fb.1.1.1' && c.fbc === 'fb.1.1.abc' && c.ip === '203.0.113.9' && c.ua === 'TestUA/1' && c.url === 'https://example.com/customise/abc', c);
  const bareReq = new NextRequest('https://example.com/', { headers: { cookie: 'pt_consent=v1.a1.m1' } });
  const b = metaClientFromRequest(bareReq);
  ok('missing headers/cookies are null', !!b && b.fbp === null && b.fbc === null && b.ip === null && b.ua === null && b.url === null, b);

  console.log(`${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
