/**
 * POST /api/admin/offers/campaigns
 *   { action: 'create', name, subject?, intro?, designs?: <pasted ids or links>, collectionPath? }   a draft campaign
 *   { action: 'audience', id }    how many people could be started now (round 1 rules without the day count, plus the 7-day gap)
 *   { action: 'start', id }       queue one offer per eligible person (round 'campaign:<id>'); they then follow generate > approve > send and the caps
 * Starting does not generate or send anything by itself: that happens in the run (cron or "Run now"), and only while offers are switched on.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, serviceClient } from '@/lib/qr/server';
import { parseDesignIds } from '@/lib/offers/parse';
import { campaignAudience, insertQueued, offersTablesExist } from '@/lib/offers/run';
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
      const { data: row, error } = await supabase.from('offer_campaigns').insert({ name, subject: text(body.subject, 150), intro: text(body.intro, 240), design_ids: ids, collection_path: path }).select('id').single();
      if (error) return fail(error.message, 500);
      return NextResponse.json({ ok: true, id: (row as any).id });
    }

    const id = String(body?.id ?? '');
    if (!UUID.test(id)) return fail('Not found', 404);
    const { data: campaign } = await supabase.from('offer_campaigns').select('*').eq('id', id).maybeSingle();
    if (!campaign) return fail('Not found', 404);
    const c: any = campaign;

    if (body.action === 'audience') {
      const [people, designs] = await Promise.all([campaignAudience(supabase, id, Date.now()), campaignDesignIds(supabase, c)]);
      return NextResponse.json({ ok: true, eligible: people.length, designs: designs.length });
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
