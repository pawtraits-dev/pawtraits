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
import { loadCampaignPeople, loadCandidateEmails, loadPaidOrderTimes, loadPeople } from './data';
import { pickAutomatic } from './dates';
import { buildAudience, dueFor, dueNow, gapOk, type AudienceChoice, type AudiencePerson, type Due, type PersonFacts } from './eligibility';
import { BIRTHDAY_COLLECTION, generateOffer, zodiacCollection } from './generate';
import { MIN_BIRTHDAY_DESIGNS, campaignDesignIds, loadDataset, loadDesigns, pickZodiacCard, suitableCount, type DesignRow } from './select-designs';
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

/** Is the second migration (2026-11-16-offers-campaigns.sql: buyers, birthdays, automatic campaigns) in place? Without it, everything for buyers is quietly off. */
export async function campaignsMigrationReady(supabase: SupabaseClient): Promise<boolean> {
  const a = await supabase.from('preview_offers').select('audience, source_pet_id, event_date').limit(1);
  if (a.error) return false;
  const b = await supabase.from('offer_campaigns').select('kind, audience, enabled').limit(1);
  if (b.error) return false;
  const c = await supabase.from('email_preferences').select('photo_words_shown_at, photo_offers_opt_out_at, pet_birth_month').limit(1);
  return !c.error;
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

export interface AutomaticCampaign { id: string; kind: 'birthday' | 'zodiac'; enabled: boolean; audience: AudienceChoice; subject: string | null; intro: string | null }

/** The two built-in automatic campaigns (rows of offer_campaigns, kind 'birthday' / 'zodiac'), created here if they are not there yet. Both start OFF. */
export async function ensureAutomaticCampaigns(supabase: SupabaseClient): Promise<AutomaticCampaign[]> {
  const read = async () => ((await supabase.from('offer_campaigns').select('*').in('kind', ['birthday', 'zodiac'])).data ?? []) as any[];
  let rows = await read();
  const missing = (['birthday', 'zodiac'] as const).filter(k => !rows.some(r => r.kind === k));
  if (missing.length) {
    await supabase.from('offer_campaigns').upsert(missing.map(kind => ({
      kind, name: kind === 'birthday' ? 'Birthday' : 'Zodiac', enabled: false, audience: 'both', status: 'draft', design_ids: [],
      collection_path: kind === 'birthday' ? BIRTHDAY_COLLECTION : null,
    })), { onConflict: 'kind', ignoreDuplicates: true });
    rows = await read();
  }
  return rows.map(r => ({ id: r.id, kind: r.kind, enabled: r.enabled === true, audience: (['previewers', 'buyers', 'both'].includes(r.audience) ? r.audience : 'both') as AudienceChoice, subject: r.subject ?? null, intro: r.intro ?? null }));
}

/**
 * (a2) Queue the automatic birthday and zodiac offers that are due, for each campaign that is switched on (never otherwise). Same caps as everything
 * else (QUEUE_MAX here, the per-run and per-day generation caps later), the one-offer-email-a-week rule, and the birthday goes first when both are due.
 * Nothing is queued without something to paint into: a zodiac needs that sign's card for the pet's animal, a birthday needs at least 2 birthday designs.
 */
export async function queueAutomatic(supabase: SupabaseClient, settings: OfferSettings, now: number, already = 0): Promise<number> {
  if (!(await campaignsMigrationReady(supabase))) return 0;
  const campaigns = (await ensureAutomaticCampaigns(supabase)).filter(c => c.enabled);
  const birthday = campaigns.find(c => c.kind === 'birthday'), zodiac = campaigns.find(c => c.kind === 'zodiac');
  if (!birthday && !zodiac) return 0;

  const people = await loadCampaignPeople(supabase);
  const byEmail = new Map(people.map(p => [p.email, p] as const));
  const opts = { graceDays: settings.noticeGraceDays };
  const forBirthday = new Map(buildAudience(people, now, { ...opts, audience: birthday?.audience }).map(a => [a.email, a] as const));
  const forZodiac = new Map(buildAudience(people, now, { ...opts, audience: zodiac?.audience }).map(a => [a.email, a] as const));

  let designs: DesignRow[] | null = null;
  let birthdayIds: string[] | null = null;
  const signIds = new Map<string, string[]>();
  const cfg = { birthdayOn: !!birthday, zodiacOn: !!zodiac, birthdayDays: settings.birthdayDaysBefore, zodiacDays: settings.zodiacDaysBefore };
  let queued = 0;
  for (const email of Array.from(new Set([...Array.from(forBirthday.keys()), ...Array.from(forZodiac.keys())]))) {
    if (already + queued >= QUEUE_MAX) break;
    const facts = byEmail.get(email)!;
    const b = forBirthday.get(email), z = forZodiac.get(email);
    const has = (round: string) => facts.offers.some(o => o.round === round);
    const pick = pickAutomatic({ birthday: (b ?? z)!.birthday, sign: (z ?? b)!.sign }, now, { ...cfg, birthdayOn: cfg.birthdayOn && !!b, zodiacOn: cfg.zodiacOn && !!z }, has);
    if (!pick || !gapOk(facts, now)) continue;
    const person = (pick.kind === 'birthday' ? b : z) as AudiencePerson;
    const campaign = pick.kind === 'birthday' ? birthday! : zodiac!;

    designs ??= await loadDesigns(supabase);
    if (pick.kind === 'birthday') {
      birthdayIds ??= await campaignDesignIds(supabase, { design_ids: [], collection_path: BIRTHDAY_COLLECTION });
      if (suitableCount(designs, birthdayIds, person.animal) < MIN_BIRTHDAY_DESIGNS) continue;
    } else {
      if (!person.animal) continue;   // the card is worded for a dog or a cat
      if (!signIds.has(pick.sign)) signIds.set(pick.sign, await campaignDesignIds(supabase, { design_ids: [], collection_path: zodiacCollection(pick.sign) }));
      if (!pickZodiacCard({ designs, sales: [], signDesignIds: signIds.get(pick.sign)!, animal: person.animal, excludeDesignIds: [] })) continue;
    }
    if (!(await canEmail(supabase, email, 'offers'))) continue;
    if (await insertQueued(supabase, person, dueFor(person, pick.round, now, pick.eventDate), campaign.id)) queued++;
  }
  return queued;
}

/** Queue one offer; the unique (email, round) makes a second try a no-op. True when a row was added. */
export async function insertQueued(supabase: SupabaseClient, p: { email: string }, due: Due, campaignId: string | null = null): Promise<boolean> {
  // The new columns are only written when there is something to put in them, so round 1, round 2 and previewer campaigns work before the second migration is run
  const extended = due.audience === 'buyer' || !!due.sourcePetId || !!due.eventDate;
  const { data, error } = await supabase.from('preview_offers').upsert({
    email: p.email, request_id: due.requestId, source_custom_image_id: due.sourceImageId, round: due.round, campaign_id: campaignId,
    status: 'queued', due_at: new Date(due.dueAt).toISOString(),
    ...(extended ? { audience: due.audience ?? 'previewer', source_pet_id: due.sourcePetId ?? null, event_date: due.eventDate ?? null } : {}),
  }, { onConflict: 'email,round', ignoreDuplicates: true }).select('id');
  if (error) { console.error('offers: could not queue', error.message); return false; }
  return (data ?? []).length > 0;
}

/**
 * People a hand-started campaign could start for right now: previewers (the round 1 rules without the day count) and buyers (who have been shown the
 * photo wording for at least offers_notice_grace_days), per the campaign's own audience; nobody who already has this campaign; the 7-day gap.
 * `audience` overrides the campaign's own choice (for counting).
 */
export async function campaignAudience(supabase: SupabaseClient, campaignId: string, now: number, audience?: AudienceChoice): Promise<{ person: AudiencePerson; due: Due }[]> {
  const { data: row } = await supabase.from('offer_campaigns').select('*').eq('id', campaignId).maybeSingle();
  const choice: AudienceChoice = audience ?? (['previewers', 'buyers', 'both'].includes((row as any)?.audience) ? (row as any).audience : 'previewers');
  const settings = await loadOfferSettings();
  const people = await loadCampaignPeople(supabase);
  const round = `campaign:${campaignId}`;
  const byEmail = new Map(people.map(p => [p.email, p] as const));
  const out: { person: AudiencePerson; due: Due }[] = [];
  for (const a of buildAudience(people, now, { graceDays: settings.noticeGraceDays, audience: choice })) {
    const facts = byEmail.get(a.email)!;
    if (!gapOk(facts, now) || a.offers.some(o => o.round === round)) continue;
    if (await canEmail(supabase, a.email, 'offers')) out.push({ person: a, due: dueFor(a, round, now) });
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
  try { result.queued += await queueAutomatic(supabase, settings, now, result.queued); } catch (e) { console.error('offers: automatic queueing failed', e); }

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
