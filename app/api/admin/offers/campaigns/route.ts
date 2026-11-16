/**
 * POST /api/admin/offers/campaigns
 *   { action: 'create', name, subject?, intro?, audience?: 'previewers' | 'buyers' | 'both', designs?: <pasted ids or links>, collectionPath? }   a draft campaign
 *   { action: 'audience', id }    how many people could be started now, split by previewers and buyers (the round 1 rules without the day count for
 *                                 previewers; buyers who were shown the photo wording; plus the 7-day gap)
 *   { action: 'auto_save', kind: 'birthday' | 'zodiac', enabled?, audience?, subject?, intro? }   the automatic campaigns' own switch, audience and wording
 *   { action: 'auto_stats' }      how many people have a known birthday / sign and how many are due in the next 30 days
 *   { action: 'start', id }       queue one offer per eligible person (round 'campaign:<id>'); they then follow generate > approve > send and the caps
 * Starting does not generate or send anything by itself: that happens in the run (cron or "Run now"), and only while offers are switched on.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, serviceClient } from '@/lib/qr/server';
import { parseDesignIds } from '@/lib/offers/parse';
import { campaignAudience, campaignsMigrationReady, ensureAutomaticCampaigns, insertQueued, offersTablesExist } from '@/lib/offers/run';
import { loadAutomaticStats } from '@/lib/offers/admin';
import { CAMPAIGNS_MIGRATION_FILE } from '@/lib/offers/settings';
import { campaignDesignIds } from '@/lib/offers/select-designs';
import { loadOfferSettings } from '@/lib/offers/settings';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });
const text = (v: unknown, max: number) => { const s = String(v ?? '').trim(); return s ? s.slice(0, max) : null; };

export async function POST(request: NextRequest) {
  const denied = await requireAdmin(); if (denied) return denied;
  const body = await request.json().catch(() => ({}));
  const supabase = serviceClient();
  if (!(await offersTablesExist(supabase))) return fail('Run db/migrations/2026-11-16-preview-offers.sql first', 503);

  try {
    if (body?.action === 'create') {
      const name = text(body.name, 80);
      if (!name) return fail('Give the campaign a name');
      const ids = parseDesignIds(body.designs);
      const path = text(body.collectionPath, 120)?.replace(/^\/+|\/+$/g, '') ?? null;
      if (!ids.length && !path) return fail('Choose some designs or a collection');
      if (ids.length) {
        const { data } = await supabase.from('image_catalog').select('id').in('id', ids);
        const found = new Set(((data ?? []) as any[]).map(r => r.id));
        const missing = ids.filter(i => !found.has(i));
        if (missing.length) return fail(`${missing.length} of those designs could not be found (${missing[0]}...)`);
      }
      if (path) {
        const { data } = await supabase.from('collections').select('id').eq('path', path).maybeSingle();
        if (!data) return fail('That collection does not exist');
      }
      const audience = ['previewers', 'buyers', 'both'].includes(body.audience) ? body.audience : 'both';
      const ready = await campaignsMigrationReady(supabase);
      if (!ready && audience !== 'previewers') return fail(`Run ${CAMPAIGNS_MIGRATION_FILE} first to include people who have bought`, 503);
      const { data: row, error } = await supabase.from('offer_campaigns').insert({ name, subject: text(body.subject, 150), intro: text(body.intro, 240), design_ids: ids, collection_path: path, ...(ready ? { audience } : {}) }).select('id').single();
      if (error) return fail(error.message, 500);
      return NextResponse.json({ ok: true, id: (row as any).id });
    }

    if (body.action === 'auto_stats') {
      if (!(await campaignsMigrationReady(supabase))) return fail(`Run ${CAMPAIGNS_MIGRATION_FILE} first`, 503);
      return NextResponse.json({ ok: true, ...(await loadAutomaticStats(supabase)) });
    }
    if (body.action === 'auto_save') {
      if (!(await campaignsMigrationReady(supabase))) return fail(`Run ${CAMPAIGNS_MIGRATION_FILE} first`, 503);
      const kind = body.kind === 'zodiac' ? 'zodiac' : body.kind === 'birthday' ? 'birthday' : null;
      if (!kind) return fail('Unknown campaign');
      const row = (await ensureAutomaticCampaigns(supabase)).find(c => c.kind === kind);
      if (!row) return fail('Could not find that campaign', 500);
      const patch: Record<string, unknown> = {};
      if (typeof body.enabled === 'boolean') patch.enabled = body.enabled;
      if (['previewers', 'buyers', 'both'].includes(body.audience)) patch.audience = body.audience;
      if ('subject' in body) patch.subject = text(body.subject, 150);
      if ('intro' in body) patch.intro = text(body.intro, 240);
      if (Object.keys(patch).length) await supabase.from('offer_campaigns').update(patch).eq('id', row.id);
      return NextResponse.json({ ok: true });
    }

    const id = String(body?.id ?? '');
    if (!UUID.test(id)) return fail('Not found', 404);
    const { data: campaign } = await supabase.from('offer_campaigns').select('*').eq('id', id).maybeSingle();
    if (!campaign) return fail('Not found', 404);
    const c: any = campaign;
    if ((c.kind ?? 'manual') !== 'manual') return fail('The automatic campaigns run by themselves: use their switch');

    if (body.action === 'audience') {
      const [people, designs] = await Promise.all([campaignAudience(supabase, id, Date.now()), campaignDesignIds(supabase, c)]);
      const buyers = people.filter(p => p.person.audience === 'buyer').length;
      return NextResponse.json({ ok: true, eligible: people.length, previewers: people.length - buyers, buyers, designs: designs.length });
    }
    if (body.action === 'start') {
      if (c.status !== 'draft') return fail('This campaign has already been started');
      if (!(await loadOfferSettings()).enabled) return fail('Switch offers on first: nothing is queued while they are off');
      const designs = await campaignDesignIds(supabase, c);
      if (designs.length < 3) return fail('The campaign needs at least 3 designs to draw from');
      const people = await campaignAudience(supabase, id, Date.now());
      let queued = 0;
      for (const { person, due } of people) if (await insertQueued(supabase, person, due, id)) queued++;
      await supabase.from('offer_campaigns').update({ status: 'running', started_at: new Date().toISOString() }).eq('id', id).eq('status', 'draft');
      return NextResponse.json({ ok: true, queued });
    }
    return fail('Unknown action');
  } catch (e: any) {
    console.error('offers campaign failed', e);
    return fail(e?.message || 'Something went wrong', 500);
  }
}
