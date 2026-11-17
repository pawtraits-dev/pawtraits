/**
 * Admin > Customer Referrals (read only; server only for the loader, every other function is pure so
 * scripts/test-referral-report.ts needs no database).
 *
 * Tables read: customers (personal_referral_code, referral_type, referrer_id, referral_code_used,
 * current_credit_balance), orders (referral_code, paid, not cancelled), customer_referrals (qr_scans_count = link opens,
 * one row per code), commissions (commission_type = 'customer_credit'), user_profiles (id, customer_id: link to the customer page).
 *
 * The referral graph: a node is a person keyed by lower-cased email (a buyer with no customers row is a "guest" node
 * with no code). P is the PARENT of C when
 *   (a) C's customers row says P referred them (referral_type 'CUSTOMER' and referrer_id = P.id, or referral_code_used = P's code), or
 *   (b) a qualifying sale made with P's code was bought by C's email.
 * A child may have several parents. Edges are a set: one per parent-child pair. Never an edge to oneself.
 *
 * Descendants are walked breadth first, so a person who is both a child and a later-generation descendant counts as a child.
 * A sale is counted once per ancestor whichever path leads to it. Cycles end at the visited set.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { csvField, fetchAll, NOT_A_SALE } from '../marketing/audiences';
import { maskEmail } from '../marketing/preferences';
import { unconfirmedReferral } from './unconfirmed';

export type Period = '30' | '90' | '365' | 'all';
export type Sort = 'network' | 'direct' | 'descendants' | 'opens' | 'credit';
export const PERIODS: Period[] = ['30', '90', '365', 'all'];
export const SORTS: Sort[] = ['network', 'direct', 'descendants', 'opens', 'credit'];
export const MAX_ROWS = 500;
export const TREE_NODE_CAP = 200;
const DAY = 86_400_000;

// ---------------------------------------------------------------------------------------------
// Row shapes read from the database

export interface CustomerRow {
  id: string;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  personal_referral_code?: string | null;
  referral_type?: string | null;
  referrer_id?: string | null;
  referral_code_used?: string | null;
  current_credit_balance?: number | null; // pence
  created_at?: string | null;
}
export interface SaleRow {
  id: string;
  customer_email: string | null;
  referral_code: string | null;
  payment_status?: string | null;
  status?: string | null;
  total_amount?: number | null;    // pence, what was paid including delivery
  subtotal_amount?: number | null; // pence
  discount_amount?: number | null; // pence
  created_at: string;
}
export interface LinkRow {
  referral_code: string;
  referrer_customer_id?: string | null;
  qr_scans_count?: number | null;
  accessed_at?: string | null;
  updated_at?: string | null;
}
export interface CreditRow {
  order_id: string | null;
  recipient_id: string;
  recipient_type?: string | null;
  commission_type?: string | null;
  commission_amount: number | null; // pence
  status?: string | null;
  created_at: string;
}
export interface ProfileRow { id: string; customer_id: string | null }

/** A held order that may carry metadata.referralUnconfirmed (lib/referrals/unconfirmed.ts) */
export interface HeldOrderRow { id: string; metadata?: unknown; created_at?: string | null }

export interface ReportInput {
  /** Orders held for review (status on_hold); optional */
  heldOrders?: HeldOrderRow[];
  customers: CustomerRow[];
  orders: SaleRow[];
  links: LinkRow[];
  commissions: CreditRow[];
  profiles: ProfileRow[];
}

// ---------------------------------------------------------------------------------------------
// Output shapes (emails are always masked)

export interface Money { orders: number; value: number }
export interface PersonRow {
  id: string;                 // customers.id
  profileId: string | null;   // user_profiles.id: the admin customer page is /admin/customers/<profileId>
  name: string;
  email: string;              // masked
  code: string;
  linkOpens: number;
  direct: { orders: number; value: number; discount: number; buyers: number };
  referred: number;
  credit: { earned: number; orders: number; balance: number };
  descendants: { people: number; orders: number; value: number; depth: number };
  network: Money;
  uncredited: number;
  lastUsed: string | null;
}
export interface Summary {
  customersWithCode: number;
  codesUsed: number;
  linkOpens: number;
  referredOrders: number;
  referredValue: number;
  creditGiven: number;
  uncredited: number;
  deepestChain: number;
  /** Held orders in the period whose referral code could not be checked at the time */
  unconfirmedReferrals: number;
}
export interface TreeNode {
  name: string;
  email: string; // masked
  code: string | null;
  direct: Money;
  children: TreeNode[];
}
export interface TreeResult { root: TreeNode; truncated: boolean; nodes: number }

// ---------------------------------------------------------------------------------------------
// Small helpers

export const normEmail = (e: string | null | undefined) => String(e ?? '').trim().toLowerCase();
export const normCode = (c: string | null | undefined) => String(c ?? '').trim().toUpperCase();
const n = (v: number | null | undefined) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const time = (iso: string | null | undefined) => { const t = iso ? Date.parse(iso) : NaN; return Number.isNaN(t) ? null : t; };
export const pounds = (pence: number) => (pence / 100).toFixed(2);

export function periodStart(period: Period, now = Date.now()): number | null {
  return period === 'all' ? null : now - Number(period) * DAY;
}

/** Display name: first and last name, else the masked email */
function displayName(c: CustomerRow | undefined, masked: string): string {
  const full = [c?.first_name, c?.last_name].map(s => String(s ?? '').trim()).filter(Boolean).join(' ');
  return full || masked;
}

// ---------------------------------------------------------------------------------------------
// The report

interface Person { key: string; customer?: CustomerRow; code: string | null }

export interface Report {
  rows: PersonRow[];          // everyone with a code, unsorted
  summary: Summary;
  keyById: Map<string, string>;
  tree: (key: string, maxDepth?: number) => TreeResult | null;
}

export function buildReport(input: ReportInput, opts: { period?: Period; now?: number } = {}): Report {
  const from = periodStart(opts.period ?? 'all', opts.now ?? Date.now());
  const inPeriod = (iso: string | null | undefined) => {
    if (from === null) return true;
    const t = time(iso);
    return t !== null && t >= from;
  };

  // People with a customers row
  const people = new Map<string, Person>();
  const codeToKey = new Map<string, string>();
  const keyById = new Map<string, string>();
  const customerByKey = new Map<string, CustomerRow>();
  for (const c of input.customers) {
    const key = normEmail(c.email);
    if (!key || people.has(key)) continue;
    const code = normCode(c.personal_referral_code) || null;
    people.set(key, { key, customer: c, code });
    customerByKey.set(key, c);
    keyById.set(c.id, key);
    if (code && !codeToKey.has(code)) codeToKey.set(code, key);
  }

  // Qualifying sales made with a customer's code, in the period
  const salesByKey = new Map<string, SaleRow[]>(); // owner of the code -> sales
  const salesById = new Map<string, SaleRow>();
  const buyerOf = new Map<string, string>();       // sale id -> buyer key
  for (const o of input.orders) {
    if (String(o.payment_status ?? '').toLowerCase() !== 'paid') continue;
    if (NOT_A_SALE.has(String(o.status ?? '').toLowerCase())) continue;
    if (!inPeriod(o.created_at)) continue;
    const owner = codeToKey.get(normCode(o.referral_code));
    if (!owner) continue; // a partner code, or no code
    const buyer = normEmail(o.customer_email);
    const list = salesByKey.get(owner) ?? [];
    list.push(o);
    salesByKey.set(owner, list);
    salesById.set(o.id, o);
    buyerOf.set(o.id, buyer);
    if (buyer && !people.has(buyer)) people.set(buyer, { key: buyer, code: null }); // guest
  }

  // Edges: parent -> children (sets, so one edge per pair)
  const children = new Map<string, Set<string>>();
  const addEdge = (parent: string | undefined, child: string | undefined) => {
    if (!parent || !child || parent === child) return;
    if (!people.has(parent) || !people.has(child)) return;
    const set = children.get(parent) ?? new Set<string>();
    set.add(child);
    children.set(parent, set);
  };
  for (const c of input.customers) {
    const child = normEmail(c.email);
    if (!child || customerByKey.get(child) !== c) continue;
    if (String(c.referral_type ?? '').toUpperCase() === 'CUSTOMER' && c.referrer_id) addEdge(keyById.get(c.referrer_id), child);
    const used = normCode(c.referral_code_used);
    if (used) addEdge(codeToKey.get(used), child);
  }
  salesByKey.forEach((sales, owner) => { for (const s of sales) addEdge(owner, buyerOf.get(s.id)); });

  // Link opens
  const linkByCode = new Map<string, LinkRow>();
  for (const l of input.links) {
    const code = normCode(l.referral_code);
    if (code && !linkByCode.has(code)) linkByCode.set(code, l);
  }

  // Credit
  const creditsByRecipient = new Map<string, { earned: number; orders: number }>();
  const creditedOrders = new Set<string>();
  for (const cm of input.commissions) {
    if (cm.commission_type !== 'customer_credit') continue;
    if (cm.recipient_type && cm.recipient_type !== 'customer') continue;
    if (cm.order_id) creditedOrders.add(cm.order_id); // any date: "was this sale credited" does not depend on the period
    if (!inPeriod(cm.created_at)) continue;
    const cur = creditsByRecipient.get(cm.recipient_id) ?? { earned: 0, orders: 0 };
    cur.earned += n(cm.commission_amount);
    cur.orders += 1;
    creditsByRecipient.set(cm.recipient_id, cur);
  }

  const profileByCustomer = new Map<string, string>();
  for (const p of input.profiles) if (p.customer_id && !profileByCustomer.has(p.customer_id)) profileByCustomer.set(p.customer_id, p.id);

  const sum = (sales: SaleRow[], f: (s: SaleRow) => number | null | undefined) => sales.reduce((a, s) => a + n(f(s)), 0);
  const maskedOf = (key: string) => maskEmail(key);

  // Everyone with a code
  const rows: PersonRow[] = [];
  const rowByKey = new Map<string, PersonRow>();
  people.forEach(p => {
    if (!p.code || !p.customer) return;
    const c = p.customer;
    const sales = salesByKey.get(p.key) ?? [];
    const link = linkByCode.get(p.code);

    // Walk downwards, breadth first
    const depthOf = new Map<string, number>([[p.key, 0]]);
    let frontier = [p.key];
    let depth = 0;
    let grand = 0;
    const saleIds = new Set<string>();
    while (frontier.length) {
      const next: string[] = [];
      for (const k of frontier) {
        const kids = children.get(k);
        if (!kids) continue;
        kids.forEach(kid => {
          if (depthOf.has(kid)) return;
          depthOf.set(kid, depth + 1);
          next.push(kid);
        });
      }
      if (next.length) {
        depth++;
        if (depth >= 2) grand += next.length;
        for (const k of next) for (const s of salesByKey.get(k) ?? []) saleIds.add(s.id);
      }
      frontier = next;
    }
    let dValue = 0;
    saleIds.forEach(id => { dValue += n(salesById.get(id)?.total_amount); });

    const earned = creditsByRecipient.get(c.id) ?? { earned: 0, orders: 0 };
    const directValue = sum(sales, s => s.total_amount);
    const dates = [...sales.map(s => time(s.created_at)), time(link?.accessed_at), time(link?.updated_at)].filter((t): t is number => t !== null);

    const row: PersonRow = {
      id: c.id,
      profileId: profileByCustomer.get(c.id) ?? null,
      name: displayName(c, maskedOf(p.key)),
      email: maskedOf(p.key),
      code: p.code,
      linkOpens: n(link?.qr_scans_count),
      direct: {
        orders: sales.length,
        value: directValue,
        discount: sum(sales, s => s.discount_amount),
        buyers: new Set(sales.map(s => buyerOf.get(s.id)).filter(Boolean)).size,
      },
      referred: children.get(p.key)?.size ?? 0,
      credit: { earned: earned.earned, orders: earned.orders, balance: n(c.current_credit_balance) },
      descendants: { people: grand, orders: saleIds.size, value: dValue, depth },
      network: { orders: sales.length + saleIds.size, value: directValue + dValue },
      uncredited: sales.filter(s => !creditedOrders.has(s.id)).length,
      lastUsed: dates.length ? new Date(Math.max(...dates)).toISOString() : null,
    };
    rows.push(row);
    rowByKey.set(p.key, row);
  });

  const summary: Summary = {
    customersWithCode: rows.length,
    codesUsed: rows.filter(r => r.direct.orders > 0).length,
    linkOpens: rows.reduce((a, r) => a + r.linkOpens, 0),
    referredOrders: rows.reduce((a, r) => a + r.direct.orders, 0),
    referredValue: rows.reduce((a, r) => a + r.direct.value, 0),
    creditGiven: rows.reduce((a, r) => a + r.credit.earned, 0),
    uncredited: rows.reduce((a, r) => a + r.uncredited, 0),
    deepestChain: rows.reduce((a, r) => Math.max(a, r.descendants.depth), 0),
    unconfirmedReferrals: (input.heldOrders ?? []).filter(o => inPeriod(o.created_at) && unconfirmedReferral(o.metadata)).length,
  };

  const networkValue = (key: string) => rowByKey.get(key)?.network.value ?? 0;
  const nodeName = (p: Person) => displayName(p.customer, maskedOf(p.key));
  const sortedKids = (key: string): string[] => Array.from(children.get(key) ?? [])
    .sort((a, b) => networkValue(b) - networkValue(a) || nodeName(people.get(a)!).localeCompare(nodeName(people.get(b)!)) || (a < b ? -1 : 1));
  const own = (key: string): Money => {
    const sales = salesByKey.get(key) ?? [];
    return { orders: sales.length, value: sum(sales, s => s.total_amount) };
  };

  const tree = (key: string, maxDepth = 6): TreeResult | null => {
    const rootPerson = people.get(key);
    if (!rootPerson) return null;
    let nodes = 0;
    let truncated = false;
    const make = (k: string, path: Set<string>, level: number): TreeNode => {
      const p = people.get(k)!;
      const node: TreeNode = { name: nodeName(p), email: maskedOf(k), code: p.code, direct: own(k), children: [] };
      const kids = sortedKids(k).filter(kid => !path.has(kid));
      if (!kids.length) return node;
      if (level >= maxDepth) { truncated = true; return node; }
      const nextPath = new Set(path).add(k);
      for (const kid of kids) {
        if (nodes >= TREE_NODE_CAP) { truncated = true; break; }
        nodes++;
        node.children.push(make(kid, nextPath, level + 1));
      }
      return node;
    };
    const root = make(key, new Set([key]), 0);
    return { root, truncated, nodes };
  };

  return { rows, summary, keyById, tree };
}

// ---------------------------------------------------------------------------------------------
// Rows for the page and CSV

export const hasActivity = (r: PersonRow) => r.linkOpens > 0 || r.direct.orders > 0 || r.referred > 0;

const sortValue: Record<Sort, (r: PersonRow) => number> = {
  network: r => r.network.value,
  direct: r => r.direct.value,
  descendants: r => r.descendants.value,
  opens: r => r.linkOpens,
  credit: r => r.credit.earned,
};

export function sortRows(rows: PersonRow[], sort: Sort): PersonRow[] {
  const f = sortValue[sort];
  return rows.slice().sort((a, b) => f(b) - f(a) || b.network.value - a.network.value || a.code.localeCompare(b.code));
}

export function selectRows(rows: PersonRow[], sort: Sort, all: boolean): { rows: PersonRow[]; total: number; truncated: boolean } {
  const pool = sortRows(all ? rows : rows.filter(hasActivity), sort);
  return { rows: pool.slice(0, MAX_ROWS), total: pool.length, truncated: pool.length > MAX_ROWS };
}

const CSV_HEADER = [
  'Customer', 'Email (masked)', 'Code', 'Link opens', 'Sales with their code', 'Sales value (GBP)', 'Discount given (GBP)', 'Buyers',
  'People referred', 'Descendants (people)', 'Deepest level', 'Descendant sales', 'Descendant value (GBP)', 'Network sales', 'Network value (GBP)',
  'Credit earned (GBP)', 'Credit orders', 'Credit balance (GBP)', 'Sales with no credit', 'Last used',
];

export function referralsCsv(rows: PersonRow[]): string {
  const lines = [CSV_HEADER.join(',')];
  for (const r of rows) {
    lines.push([
      r.name, r.email, r.code, r.linkOpens, r.direct.orders, pounds(r.direct.value), pounds(r.direct.discount), r.direct.buyers,
      r.referred, r.descendants.people, r.descendants.depth, r.descendants.orders, pounds(r.descendants.value), r.network.orders, pounds(r.network.value),
      pounds(r.credit.earned), r.credit.orders, pounds(r.credit.balance), r.uncredited, r.lastUsed ? r.lastUsed.slice(0, 10) : '',
    ].map(csvField).join(','));
  }
  return lines.join('\n') + '\n';
}

// ---------------------------------------------------------------------------------------------
// Database

export async function loadReferralReport(supabase: SupabaseClient, opts: { period: Period }): Promise<{ report: Report; truncated: boolean }> {
  const [customers, orders, links, commissions, profiles, held] = await Promise.all([
    fetchAll<CustomerRow>((a, b) => supabase.from('customers')
      .select('id, email, first_name, last_name, personal_referral_code, referral_type, referrer_id, referral_code_used, current_credit_balance, created_at')
      .order('created_at', { ascending: true }).order('id').range(a, b)),
    fetchAll<SaleRow>((a, b) => supabase.from('orders')
      .select('id, customer_email, referral_code, payment_status, status, total_amount, subtotal_amount, discount_amount, created_at')
      .not('referral_code', 'is', null).eq('payment_status', 'paid')
      .order('created_at', { ascending: true }).order('id').range(a, b)),
    fetchAll<LinkRow>((a, b) => supabase.from('customer_referrals')
      .select('referral_code, referrer_customer_id, qr_scans_count, accessed_at, updated_at')
      .order('id').range(a, b)),
    fetchAll<CreditRow>((a, b) => supabase.from('commissions')
      .select('order_id, recipient_id, recipient_type, commission_type, commission_amount, status, created_at')
      .eq('commission_type', 'customer_credit')
      .order('created_at', { ascending: true }).order('id').range(a, b)),
    fetchAll<ProfileRow>((a, b) => supabase.from('user_profiles')
      .select('id, customer_id').not('customer_id', 'is', null)
      .order('id').range(a, b)),
    // metadata is jsonb holding a JSON string, so it is read and checked here rather than filtered in the database
    fetchAll<HeldOrderRow>((a, b) => supabase.from('orders')
      .select('id, metadata, created_at').eq('status', 'on_hold')
      .order('created_at', { ascending: true }).order('id').range(a, b)),
  ]);
  const report = buildReport({
    customers: customers.rows, orders: orders.rows, links: links.rows, commissions: commissions.rows, profiles: profiles.rows, heldOrders: held.rows,
  }, { period: opts.period });
  return { report, truncated: [customers, orders, links, commissions, profiles, held].some(r => r.truncated) };
}
