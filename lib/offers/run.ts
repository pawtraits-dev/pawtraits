/**
 * Offers: one pass of the cron (server only). runOffers({ now, limit }):
 *   (a) queue whoever is newly due for round 1 / round 2,
 *   (b) generate up to N queued offers (N: offers_per_run, the daily cap offers_per_day, and `limit`),
 *   (c) when offers_auto_send is on, send the 'ready' ones.
 * Nothing at all happens while offers_enabled is off. Safe to run concurrently: an offer is claimed with a conditional update
 * (status queued -> generating) and only the caller whose update changed a row works on it.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { canEmail } from '@/lib/marketing/preferences';
import { loadCandidateEmails, loadPaidOrderTimes, loadPeople } from './data';
import { dueNow, campaignDue, type Due, type PersonFacts } from './eligibility';
import { generateOffer } from './generate';
import { loadDataset } from './select-designs';
import { sendOffer } from './send';
import { dayUsage } from './usage';
import { DAY_MS, loadOfferSettings, type OfferSettings } from './settings';

export interface RunResult {
  ran: boolean;
  reason?: 'off' | 'migration';
  queued: number;
  generated: number;
  ready: number;
  failed: number;
  skipped: number;
  sent: number;
  dayUsed: number;
  dayCap: number;
}

const EMPTY: RunResult = { ran: false, queued: 0, generated: 0, ready: 0, failed: 0, skipped: 0, sent: 0, dayUsed: 0, dayCap: 0 };
/** A claimed offer older than this has lost its worker (the function was stopped): it becomes 'failed' so it can be tried again */
const STUCK_MS = 20 * 60 * 1000;
/** Leave this much of the function's 300 seconds for the last offer to finish */
const BUDGET_MS = 200_000;
const QUEUE_MAX = 200;

export async function offersDayUsage(supabase: SupabaseClient, now: number): Promise<number> {
  const since = new Date(now - DAY_MS).toISOString();
  const { data, error } = await supabase.from('preview_offers').select('status, generated_at, designs').or(`status.eq.generating,generated_at.gte.${since}`);
  if (error) throw new Error(error.message);
  return dayUsage((data ?? []) as any[], now);
}

/** Is the offers migration in place? */
export async function offersTablesExist(supabase: SupabaseClient): Promise<boolean> {
  const a = await supabase.from('preview_offers').select('id', { head: true, count: 'exact' }).limit(1);
  if (a.error) return false;   // table missing (or unreadable): the feature is quietly off
  const b = await supabase.from('preview_email_requests').select('photo_offers_ok, offers_stopped_at').limit(1);
  return !b.error;
}

/** (a) Queue whoever is due. Returns how many offers were queued. */
export async function queueDue(supabase: SupabaseClient, settings: OfferSettings, now: number): Promise<number> {
  const emails = await loadCandidateEmails(supabase);
  if (!emails.length) return 0;
  const paid = await loadPaidOrderTimes(supabase);
  let queued = 0;
  for (let i = 0; i < emails.length && queued < QUEUE_MAX; i += 100) {
    const people = await loadPeople(supabase, emails.slice(i, i + 100), paid);
    for (const p of people) {
      if (queued >= QUEUE_MAX) break;
      const due = dueNow(p, now, settings);
      if (!due) continue;
      if (!(await canEmail(supabase, p.email, 'offers'))) continue;   // the gate, asked only for people who are otherwise due
      if (await insertQueued(supabase, p, due)) queued++;
    }
  }
  return queued;
}

/** Queue one offer; the unique (email, round) makes a second try a no-op. True when a row was added. */
export async function insertQueued(supabase: SupabaseClient, p: PersonFacts, due: Due, campaignId: string | null = null): Promise<boolean> {
  const { data, error } = await supabase.from('preview_offers').upsert({
    email: p.email, request_id: due.requestId, source_custom_image_id: due.sourceImageId, round: due.round, campaign_id: campaignId,
    status: 'queued', due_at: new Date(due.dueAt).toISOString(),
  }, { onConflict: 'email,round', ignoreDuplicates: true }).select('id');
  if (error) { console.error('offers: could not queue', error.message); return false; }
  return (data ?? []).length > 0;
}

/** People a campaign could start for right now (the round 1 rules without the day count, plus the 7-day gap) */
export async function campaignAudience(supabase: SupabaseClient, campaignId: string, now: number): Promise<{ person: PersonFacts; due: Due }[]> {
  const emails = await loadCandidateEmails(supabase);
  const paid = await loadPaidOrderTimes(supabase);
  const out: { person: PersonFacts; due: Due }[] = [];
  for (let i = 0; i < emails.length; i += 100) {
    for (const p of await loadPeople(supabase, emails.slice(i, i + 100), paid)) {
      const due = campaignDue(p, now, campaignId);
      if (due && (await canEmail(supabase, p.email, 'offers'))) out.push({ person: p, due });
    }
  }
  return out;
}

export async function runOffers(supabase: SupabaseClient, opts: { now?: number; limit?: number } = {}): Promise<RunResult> {
  const now = opts.now ?? Date.now();
  const started = Date.now();
  const settings = await loadOfferSettings();
  if (!settings.enabled) return { ...EMPTY, reason: 'off', dayCap: settings.perDay };
  if (!(await offersTablesExist(supabase))) return { ...EMPTY, reason: 'migration', dayCap: settings.perDay };

  const result: RunResult = { ...EMPTY, ran: true, dayCap: settings.perDay };

  // Offers whose worker was stopped part way: failed, so they can be tried again by hand
  await supabase.from('preview_offers').update({ status: 'failed', error: 'Stopped part way (timed out). Try again.' })
    .eq('status', 'generating').lt('generated_at', new Date(now - STUCK_MS).toISOString());

  // (a) queue
  try { result.queued = await queueDue(supabase, settings, now); } catch (e) { console.error('offers: queueing failed', e); }

  // (b) generate
  const used = await offersDayUsage(supabase, now);
  const room = Math.max(0, Math.min(settings.perRun, opts.limit ?? settings.perRun, settings.perDay - used));
  result.dayUsed = used;
  if (room > 0) {
    const { data: queued } = await supabase.from('preview_offers').select('*').eq('status', 'queued').lte('due_at', new Date(now).toISOString()).order('due_at').limit(room);
    if ((queued ?? []).length) {
      const dataset = await loadDataset(supabase, now);
      for (const o of (queued ?? []) as any[]) {
        if (Date.now() - started > BUDGET_MS) break;
        const { data: claimed } = await supabase.from('preview_offers').update({ status: 'generating', generated_at: new Date(now).toISOString(), error: null }).eq('id', o.id).eq('status', 'queued').select('*');
        if (!claimed?.length) continue;   // another run has it
        const out = await generateOffer(supabase, claimed[0] as any, dataset, now);
        result.generated++; result.dayUsed++;
        if (out.status === 'ready') result.ready++; else if (out.status === 'failed') result.failed++; else result.skipped++;
      }
    }
  }

  // (c) send: offers the owner approved (a send that failed is tried again), and, only when offers_auto_send is on, the ready ones
  const { data: toSend } = await supabase.from('preview_offers').select('id, status').in('status', settings.autoSend ? ['approved', 'ready'] : ['approved']).order('generated_at').limit(20);
  for (const o of (toSend ?? []) as any[]) {
    if (Date.now() - started > 270_000) break;
    const r = await sendOffer(supabase, o.id, { autoSend: settings.autoSend, now });
    if (r.result === 'sent') result.sent++; else if (r.result === 'skipped') result.skipped++;
  }
  return result;
}
