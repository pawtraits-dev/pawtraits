/** npx tsx scripts/test-site-url.ts */
import assert from 'node:assert/strict';
import { pickLinkBaseUrl } from '../lib/site-url';
let n = 0; const t = (a: unknown, b: unknown) => { assert.equal(a, b); n++; };
const live = { VERCEL_ENV: 'production', VERCEL_URL: 'pawtraits-abc.vercel.app', NEXT_PUBLIC_BASE_URL: 'https://www.pawtraits.pics/' };
t(pickLinkBaseUrl(live, 'https://pawtraits-abc.vercel.app'), 'https://www.pawtraits.pics');   // live: always the public address
t(pickLinkBaseUrl(live), 'https://www.pawtraits.pics');
const prev = { ...live, VERCEL_ENV: 'preview' };
t(pickLinkBaseUrl(prev, 'https://pawtraits-xyz.vercel.app/'), 'https://pawtraits-xyz.vercel.app');   // preview: back to itself
t(pickLinkBaseUrl(prev), 'https://pawtraits-abc.vercel.app');   // preview without a request (admin action)
t(pickLinkBaseUrl({ VERCEL_ENV: 'preview' }), 'https://pawtraits.pics');
t(pickLinkBaseUrl({}, 'http://localhost:3000'), 'http://localhost:3000');   // local development
t(pickLinkBaseUrl({}), 'https://pawtraits.pics');
console.log(`site-url: ${n} passed`);
