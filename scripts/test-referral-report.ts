// Run: npx tsx scripts/test-referral-report.ts
import assert from 'node:assert/strict';
import {
  buildReport, referralsCsv, selectRows, pounds, TREE_NODE_CAP,
  type CustomerRow, type SaleRow, type CreditRow, type ReportInput,
} from '../lib/referrals/admin-report';

let passed = 0;
const t = (name: string, fn: () => void) => { fn(); passed++; console.log('ok  ', name); };

const NOW = Date.parse('2026-11-16T12:00:00Z');
const daysAgo = (d: number) => new Date(NOW - d * 86_400_000).toISOString();

const cust = (id: string, code: string | null, extra: Partial<CustomerRow> = {}): CustomerRow =>
  ({ id, email: `${id}@example.com`, first_name: id.toUpperCase(), last_name: 'Test', personal_referral_code: code, referral_type: 'ORGANIC', current_credit_balance: 0, ...extra });
const referredBy = (parentId: string): Partial<CustomerRow> => ({ referral_type: 'CUSTOMER', referrer_id: parentId });
let sid = 0;
const sale = (code: string | null, buyer: string, extra: Partial<SaleRow> = {}): SaleRow =>
  ({ id: `o${++sid}`, customer_email: `${buyer}@example.com`, referral_code: code, payment_status: 'paid', status: 'confirmed', total_amount: 1000, subtotal_amount: 1100, discount_amount: 100, created_at: daysAgo(5), ...extra });
const credit = (orderId: string, recipient: string, amount = 200): CreditRow =>
  ({ order_id: orderId, recipient_id: recipient, recipient_type: 'customer', commission_type: 'customer_credit', commission_amount: amount, status: 'pending', created_at: daysAgo(5) });
const input = (p: Partial<ReportInput>): ReportInput => ({ customers: [], orders: [], links: [], commissions: [], profiles: [], ...p });
const row = (r: ReturnType<typeof buildReport>, id: string) => r.rows.find(x => x.id === id)!;

// A -> B -> C -> D by signup links
const chain = (): CustomerRow[] => [
  cust('a', 'AAAAAAAA'), cust('b', 'BBBBBBBB', referredBy('a')), cust('c', 'CCCCCCCC', referredBy('b')), cust('d', 'DDDDDDDD', referredBy('c')),
];

t('only paid, not cancelled sales with a customer code count; partner codes are ignored', () => {
  const r = buildReport(input({
    customers: [cust('a', 'AAAAAAAA')],
    orders: [
      sale('AAAAAAAA', 'x'), sale('AAAAAAAA', 'y', { payment_status: 'pending' }), sale('AAAAAAAA', 'z', { status: 'cancelled' }),
      sale('AAAAAAAA', 'w', { status: 'refunded' }), sale('PARTNER99', 'v'), sale(null, 'u'),
    ],
  }), { now: NOW });
  assert.equal(row(r, 'a').direct.orders, 1);
  assert.equal(r.summary.referredOrders, 1);
});

t('code match is case-insensitive', () => {
  const r = buildReport(input({ customers: [cust('a', 'AAAAAAAA')], orders: [sale('aaaaaaaa', 'x'), sale(' AaAaAaAa ', 'y')] }), { now: NOW });
  assert.equal(row(r, 'a').direct.orders, 2);
});

t('money sums in pence; buyers are distinct', () => {
  const r = buildReport(input({ customers: [cust('a', 'AAAAAAAA')], orders: [sale('AAAAAAAA', 'x', { total_amount: 2550 }), sale('AAAAAAAA', 'X', { total_amount: 1000 })] }), { now: NOW });
  const d = row(r, 'a').direct;
  assert.deepEqual([d.orders, d.value, d.discount, d.buyers], [2, 3550, 200, 1]);
});

t('chain A>B>C>D: direct, descendants, people, depth', () => {
  const r = buildReport(input({
    customers: chain(),
    // each person buys with their own code, so no guest buyers (which would be children) muddy the chain
    orders: [sale('AAAAAAAA', 'a'), sale('BBBBBBBB', 'b', { total_amount: 2000 }), sale('CCCCCCCC', 'c', { total_amount: 3000 }), sale('DDDDDDDD', 'd', { total_amount: 4000 })],
  }), { now: NOW });
  const a = row(r, 'a');
  assert.deepEqual([a.direct.orders, a.direct.value], [1, 1000]);
  assert.deepEqual(a.descendants, { people: 2, orders: 3, value: 9000, depth: 3 });
  assert.deepEqual(a.network, { orders: 4, value: 10000 });
  assert.equal(a.referred, 1);
  const b = row(r, 'b');
  assert.deepEqual(b.descendants, { people: 1, orders: 2, value: 7000, depth: 2 });
  assert.deepEqual(row(r, 'd').descendants, { people: 0, orders: 0, value: 0, depth: 0 });
  assert.equal(r.summary.deepestChain, 3);
});

t('a sale reachable by two paths is counted once', () => {
  // A refers B and C; both B and C are parents of D (D signed up with B, then bought with C's code)
  const r = buildReport(input({
    customers: [cust('a', 'AAAAAAAA'), cust('b', 'BBBBBBBB', referredBy('a')), cust('c', 'CCCCCCCC', referredBy('a')), cust('d', 'DDDDDDDD', referredBy('b'))],
    orders: [sale('CCCCCCCC', 'd'), sale('DDDDDDDD', 'e')],
  }), { now: NOW });
  const a = row(r, 'a');
  assert.equal(a.descendants.orders, 2); // C's code sale, and D's code sale reachable via B and C, counted once
  assert.equal(a.descendants.people, 2); // D (depth 2 by both paths) and guest e (depth 3)
});

t('a cycle A>B>A terminates and nobody is their own descendant', () => {
  const r = buildReport(input({
    customers: [cust('a', 'AAAAAAAA', referredBy('b')), cust('b', 'BBBBBBBB', referredBy('a'))],
    orders: [sale('AAAAAAAA', 'a'), sale('BBBBBBBB', 'b')],
  }), { now: NOW });
  const a = row(r, 'a'), b = row(r, 'b');
  assert.deepEqual([a.descendants.people, a.descendants.orders, a.descendants.depth], [0, 1, 1]); // B's sale only, not A's own
  assert.deepEqual([b.descendants.people, b.descendants.orders], [0, 1]);
  const tree = r.tree(r.keyById.get('a')!)!;
  assert.equal(tree.root.children.length, 1);
  assert.equal(tree.root.children[0].children.length, 0);
});

t('a self-referral is not an edge', () => {
  const r = buildReport(input({
    customers: [cust('a', 'AAAAAAAA', { referral_type: 'CUSTOMER', referrer_id: 'a', referral_code_used: 'AAAAAAAA' })],
    orders: [sale('AAAAAAAA', 'a'), sale('AAAAAAAA', 'A')],
  }), { now: NOW });
  const a = row(r, 'a');
  assert.equal(a.referred, 0);
  assert.equal(a.descendants.orders, 0);
  assert.equal(a.direct.orders, 2);
});

t('a signup link with no order still makes a child (referral_code_used too)', () => {
  const r = buildReport(input({
    customers: [cust('a', 'AAAAAAAA'), cust('b', 'BBBBBBBB', { referral_code_used: 'aaaaaaaa' })],
  }), { now: NOW });
  assert.equal(row(r, 'a').referred, 1);
});

t('a guest buyer is a child with no code', () => {
  const r = buildReport(input({ customers: [cust('a', 'AAAAAAAA')], orders: [sale('AAAAAAAA', 'guest'), sale('AAAAAAAA', 'guest')] }), { now: NOW });
  const a = row(r, 'a');
  assert.equal(a.referred, 1);
  assert.equal(a.direct.buyers, 1);
  assert.equal(r.rows.length, 1); // a guest has no row of its own
  const tree = r.tree(r.keyById.get('a')!)!;
  assert.equal(tree.root.children[0].code, null);
  assert.equal(tree.root.children[0].direct.orders, 0);
});

t('uncredited counts direct sales with no customer_credit commission', () => {
  const s1 = sale('AAAAAAAA', 'x'), s2 = sale('AAAAAAAA', 'y'), s3 = sale('AAAAAAAA', 'z');
  const r = buildReport(input({
    customers: [cust('a', 'AAAAAAAA', { current_credit_balance: 500 })],
    orders: [s1, s2, s3],
    commissions: [credit(s1.id, 'a', 200), credit(s2.id, 'a', 300), { ...credit(s3.id, 'a'), commission_type: 'partner_commission' }],
  }), { now: NOW });
  const a = row(r, 'a');
  assert.equal(a.uncredited, 1);
  assert.deepEqual(a.credit, { earned: 500, orders: 2, balance: 500 });
  assert.equal(r.summary.uncredited, 1);
  assert.equal(r.summary.creditGiven, 500);
});

t('period filter drops old sales and credit but keeps signup edges; link opens stay all-time', () => {
  const old = sale('AAAAAAAA', 'x', { created_at: daysAgo(200) });
  const recent = sale('AAAAAAAA', 'y', { created_at: daysAgo(10) });
  const oldCredit = { ...credit(old.id, 'a'), created_at: daysAgo(200) };
  const data = input({
    customers: [cust('a', 'AAAAAAAA'), cust('b', 'BBBBBBBB', referredBy('a'))],
    orders: [old, recent], commissions: [oldCredit, credit(recent.id, 'a')],
    links: [{ referral_code: 'AAAAAAAA', qr_scans_count: 7, accessed_at: daysAgo(300), updated_at: daysAgo(100) }],
  });
  const all = buildReport(data, { period: 'all', now: NOW });
  const p30 = buildReport(data, { period: '30', now: NOW });
  assert.equal(row(all, 'a').direct.orders, 2);
  assert.equal(row(all, 'a').referred, 3); // b by signup, x and y as guests
  assert.equal(row(p30, 'a').direct.orders, 1);
  assert.equal(row(p30, 'a').referred, 2); // b by signup, y; x's sale is outside the period
  assert.equal(row(p30, 'a').credit.earned, 200);
  assert.equal(row(p30, 'a').uncredited, 0);
  assert.equal(row(p30, 'a').linkOpens, 7);
  assert.equal(row(all, 'a').lastUsed, daysAgo(10));
});

t('tree nesting, sort order by network value, and depth', () => {
  const r = buildReport(input({
    customers: [cust('a', 'AAAAAAAA'), cust('b', 'BBBBBBBB', referredBy('a')), cust('c', 'CCCCCCCC', referredBy('a')), cust('d', 'DDDDDDDD', referredBy('c'))],
    orders: [sale('BBBBBBBB', 'x', { total_amount: 1000 }), sale('CCCCCCCC', 'y', { total_amount: 500 }), sale('DDDDDDDD', 'z', { total_amount: 5000 })],
  }), { now: NOW });
  const tree = r.tree(r.keyById.get('a')!)!;
  assert.deepEqual(tree.root.children.map(c => c.code), ['CCCCCCCC', 'BBBBBBBB']); // C's network 5500 > B's 1000
  assert.equal(tree.root.children[0].children[0].code, 'DDDDDDDD');
  assert.deepEqual(tree.root.children[0].direct, { orders: 1, value: 500 });
  assert.equal(tree.truncated, false);
  const shallow = r.tree(r.keyById.get('a')!, 1)!;
  assert.equal(shallow.truncated, true);
  assert.equal(shallow.root.children[0].children.length, 0);
});

t('tree is capped at the node limit and says so', () => {
  const customers = [cust('root', 'ROOTROOT')];
  for (let i = 0; i < TREE_NODE_CAP + 20; i++) customers.push(cust(`k${i}`, null, referredBy('root')));
  const r = buildReport(input({ customers }), { now: NOW });
  const tree = r.tree(r.keyById.get('root')!)!;
  assert.equal(tree.nodes, TREE_NODE_CAP);
  assert.equal(tree.root.children.length, TREE_NODE_CAP);
  assert.equal(tree.truncated, true);
});

t('rows: activity filter, sorting and the profile link', () => {
  const r = buildReport(input({
    customers: [cust('a', 'AAAAAAAA'), cust('b', 'BBBBBBBB'), cust('c', 'CCCCCCCC')],
    orders: [sale('AAAAAAAA', 'x', { total_amount: 100 }), sale('BBBBBBBB', 'y', { total_amount: 900 })],
    links: [{ referral_code: 'CCCCCCCC', qr_scans_count: 3 }],
    profiles: [{ id: 'profile-b', customer_id: 'b' }],
  }), { now: NOW });
  assert.equal(selectRows(r.rows, 'network', false).total, 3);
  assert.equal(buildReport(input({ customers: [cust('z', 'ZZZZZZZZ')] }), { now: NOW }).rows.length, 1);
  assert.equal(selectRows(buildReport(input({ customers: [cust('z', 'ZZZZZZZZ')] }), { now: NOW }).rows, 'network', false).total, 0);
  assert.equal(selectRows(buildReport(input({ customers: [cust('z', 'ZZZZZZZZ')] }), { now: NOW }).rows, 'network', true).total, 1);
  assert.deepEqual(selectRows(r.rows, 'network', false).rows.map(x => x.id), ['b', 'a', 'c']);
  assert.deepEqual(selectRows(r.rows, 'opens', false).rows.map(x => x.id)[0], 'c');
  assert.equal(row(r, 'b').profileId, 'profile-b');
  assert.equal(row(r, 'a').profileId, null);
});

t('CSV is in pounds and emails are masked everywhere', () => {
  const r = buildReport(input({
    customers: [cust('alice', 'AAAAAAAA', { current_credit_balance: 1250 }), cust('bob', 'BBBBBBBB', referredBy('alice'))],
    orders: [sale('AAAAAAAA', 'bob', { total_amount: 12345, discount_amount: 1000 }), sale('AAAAAAAA', 'carol')],
    commissions: [credit('o-x', 'alice', 250)],
  }), { now: NOW });
  assert.equal(pounds(12345), '123.45');
  const csv = referralsCsv(r.rows);
  assert.ok(csv.includes('133.45'));
  assert.ok(csv.includes('12.50')); // balance
  assert.ok(csv.includes('2.50'));  // credit earned
  const everything = csv + JSON.stringify(r.rows) + JSON.stringify(r.tree(r.keyById.get('alice')!));
  assert.ok(!/(alice|bob|carol)@example\.com/.test(everything), 'a full email leaked');
  assert.ok(!/alice@|bob@|carol@/.test(everything));
  assert.ok(csv.includes('•••@'));
});

console.log(`referral-report: ${passed} passed`);
