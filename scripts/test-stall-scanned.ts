/**
 * Stall offer only for scanned prints: the pt_stall list, lookup, signing and the mid-visit fallback.
 * Pure functions only: no network, no database. Run: npx tsx scripts/test-stall-scanned.ts
 */
import assert from 'node:assert/strict';
import { addStallScan, findStallScan, encodeStallScans, decodeStallScans, resolveScannedEntry, STALL_SCAN_MAX_ENTRIES, type StallScan } from '../lib/stall/scanned';
import { encodeAttribution, type QrAttribution } from '../lib/qr/attribution';

let n = 0;
const eq = (a: unknown, b: unknown, m: string) => { assert.deepEqual(a, b, m); n++; };
const ok = (c: unknown, m: string) => { assert.ok(c, m); n++; };
const H = 3600_000;
const NOW = 1_800_000_000_000;
const e = (imageId: string, size: string | null, ageH = 0, loc = 'loc1'): StallScan => ({ imageId, size, locationId: loc, ts: NOW - ageH * H });

// add: newest first, replace same image+size, different size kept
let l = addStallScan([], e('a', 'M', 2), NOW);
l = addStallScan(l, e('b', 'L', 1), NOW);
eq(l.map(x => x.imageId), ['b', 'a'], 'newest first');
l = addStallScan(l, e('a', 'M', 0, 'loc2'), NOW);
eq(l.length, 2, 'same image+size replaced');
eq(l[0], e('a', 'M', 0, 'loc2'), 'replaced entry has new ts and location');
l = addStallScan(l, e('a', 'S', 0), NOW);
eq(l.length, 3, 'same image, other size kept');
// expire on add
eq(addStallScan([e('old', 'M', 13)], e('x', 'M'), NOW).map(x => x.imageId), ['x'], 'stale dropped on add');
// cap
let big: StallScan[] = [];
for (let i = 0; i < 30; i++) big = addStallScan(big, { imageId: `i${i}`, size: 'M', locationId: 'l', ts: NOW - (30 - i) * 1000 }, NOW);
eq(big.length, STALL_SCAN_MAX_ENTRIES, 'capped at 24');
eq(big[0].imageId, 'i29', 'cap keeps newest');

// find
const three = [e('a', 'S'), e('b', 'M'), e('c', 'L')];
for (const x of three) ok(findStallScan(three, x.imageId, x.size, NOW), `${x.size} print found`);
eq(findStallScan(three, 'a', null, NOW)?.size, 'S', 'any size for image');
eq(findStallScan(three, 'zzz', null, NOW), null, 'unscanned image not found');
eq(findStallScan(three, 'zzz', 'M', NOW), null, 'unscanned image with size not found');
eq(findStallScan(three, 'a', 'L', NOW), null, 'scanned image at another size not found');
eq(findStallScan([e('a', 'M', 13)], 'a', 'M', NOW), null, 'expired not found');
eq(findStallScan([e('a', 'M', 5), e('a', 'M', 1, 'newer')], 'a', 'M', NOW)?.locationId, 'newer', 'freshest wins');
eq(findStallScan([e('a', null)], 'a', 'XL', NOW)?.imageId, 'a', 'sizeless sticker stands for any size');
eq(findStallScan([e('a', 'M')], 'a', 'm', NOW)?.size, 'M', 'size case-insensitive');

// encode / decode
const enc = encodeStallScans(three);
eq(decodeStallScans(enc, NOW), three, 'round trip');
eq(decodeStallScans(undefined, NOW), [], 'missing');
eq(decodeStallScans('garbage', NOW), [], 'malformed');
eq(decodeStallScans('a.b', NOW), [], 'bad signature');
const [p, sig] = enc.split('.');
const forged = Buffer.from(JSON.stringify([e('evil', 'M')])).toString('base64url');
eq(decodeStallScans(`${forged}.${sig}`, NOW), [], 'tampered payload');
eq(decodeStallScans(`${p}.${sig}x`, NOW), [], 'tampered signature');
eq(decodeStallScans(encodeStallScans([e('a', 'M', 13), e('b', 'M', 1)]), NOW).map(x => x.imageId), ['b'], 'expired entries dropped on decode');
eq(decodeStallScans(encodeStallScans([{ imageId: 1 } as any, e('b', 'M')]), NOW).length, 1, 'bad entries dropped');
eq(decodeStallScans(encodeStallScans({ a: 1 } as any), NOW), [], 'not a list');

// resolveScannedEntry
const base = { attr: null as QrAttribution | null, requestedSize: null as string | null, strict: false, now: NOW };
const cookie = encodeStallScans(three);
ok(!resolveScannedEntry({ ...base, cookieValue: cookie, imageId: 'browsed' }), 'browsed only: no offer');
ok(!resolveScannedEntry({ ...base, cookieValue: undefined, imageId: 'browsed' }), 'no cookies: no offer');
for (const x of three) eq(resolveScannedEntry({ ...base, cookieValue: cookie, imageId: x.imageId, requestedSize: x.size, strict: true })?.size, x.size, `strict ${x.size} ok`);
eq(resolveScannedEntry({ ...base, cookieValue: cookie, imageId: 'a', requestedSize: 'L', strict: true }), null, 'strict wrong size refused');
eq(resolveScannedEntry({ ...base, cookieValue: cookie, imageId: 'a', requestedSize: 'L' })?.size, 'S', 'browsing wrong size falls back to scanned size');
eq(resolveScannedEntry({ ...base, cookieValue: cookie, imageId: 'a' })?.size, 'S', 'browsing no size uses scanned size');
eq(resolveScannedEntry({ ...base, cookieValue: 'tampered.x', imageId: 'a' }), null, 'tampered cookie: no offer');
// fallback from pt_qr
const attr = (o: Partial<QrAttribution>): QrAttribution => ({ scanId: 's', imageId: 'a', locationId: 'loc1', size: 'M', ts: NOW - H, ...o });
const fb = { ...base, cookieValue: undefined as string | undefined };
eq(resolveScannedEntry({ ...fb, attr: attr({}), imageId: 'a', requestedSize: 'M', strict: true })?.locationId, 'loc1', 'fallback: last scanned print payable');
eq(resolveScannedEntry({ ...fb, attr: attr({}), imageId: 'b', requestedSize: 'M', strict: true }), null, 'fallback: other image refused');
eq(resolveScannedEntry({ ...fb, attr: attr({}), imageId: 'a', requestedSize: 'L', strict: true }), null, 'fallback: other size refused when strict');
eq(resolveScannedEntry({ ...fb, attr: attr({ locationId: null }), imageId: 'a' }), null, 'fallback: unlocated scan refused');
eq(resolveScannedEntry({ ...fb, attr: attr({ ts: NOW - 13 * H }), imageId: 'a' }), null, 'fallback: old scan refused');
eq(resolveScannedEntry({ ...fb, attr: attr({}), imageId: 'b' }), null, 'fallback: browsing another image refused');
// cookie present but empty list: the fallback does not apply
eq(resolveScannedEntry({ ...base, cookieValue: encodeStallScans([e('z', 'M')]), attr: attr({}), imageId: 'a' }), null, 'pt_stall present: pt_qr ignored');
ok(encodeAttribution(attr({})).length > 0, 'attribution still encodes');

console.log(`stall-scanned: ${n} passed`);
