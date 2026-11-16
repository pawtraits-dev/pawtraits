/**
 * GET  /api/admin/offers            the whole Offers page: settings, counts, offers (newest first), campaigns
 * POST /api/admin/offers { action, id, imageId? }
 *   approve   Approve and send (a 'ready' offer): approves it and sends it now, after the checks are made again
 *   drop      remove one picture (imageId); at least 2 must be left to send
 *   replace   paint a different design in place of one picture (imageId); counts towards the daily cap
 *   skip      skip this person's offer
 *   stop      stop offers for this person (offers_stopped_at on all their requests, and their photo opt-out) and skip this offer
 *   retry     try a failed offer again (back to the queue)
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, serviceClient } from '@/lib/qr/server';
import { loadOffersState } from '@/lib/offers/admin';
import { replacePicture } from '@/lib/offers/generate';
import { sendOffer } from '@/lib/offers/send';
import { offersDayUsage } from '@/lib/offers/run';
import { MIN_PICTURES, loadOfferSettings } from '@/lib/offers/settings';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });

export async function GET() {
  const denied = await requireAdmin(); if (denied) return denied;
  try {
    return NextResponse.json(await loadOffersState(serviceClient()));
  } catch (e: any) {
    console.error('admin offers failed', e);
    return fail(e?.message || 'Could not load offers', 500);
  }
}

export async function POST(request: NextRequest) {
  const denied = await requireAdmin(); if (denied) return denied;
  const body = await request.json().catch(() => ({}));
  const action = String(body?.action ?? ''), id = String(body?.id ?? ''), imageId = body?.imageId ? String(body.imageId) : null;
  if (!UUID.test(id) || (imageId && !UUID.test(imageId))) return fail('Not found', 404);
  const supabase = serviceClient();
  const { data } = await supabase.from('preview_offers').select('*').eq('id', id).maybeSingle();
  const offer: any = data;
  if (!offer) return fail('Not found', 404);

  try {
    switch (action) {
      case 'approve': {
        if (!(await loadOfferSettings()).enabled) return fail('Offers are switched off, so nothing is sent');
        if (offer.status !== 'ready') return fail('Only an offer waiting for approval can be approved');
        if ((offer.custom_image_ids ?? []).length < MIN_PICTURES) return fail('It needs at least 2 pictures');
        const { data: moved } = await supabase.from('preview_offers').update({ status: 'approved', approved_at: new Date().toISOString(), approved_by: 'admin' }).eq('id', id).eq('status', 'ready').select('id');
        if (!moved?.length) return fail('That offer has just changed. Refresh and look again.', 409);
        const r = await sendOffer(supabase, id, { autoSend: false });
        if (r.result === 'sent') return NextResponse.json({ ok: true, message: 'Sent' });
        if (r.result === 'skipped') return NextResponse.json({ ok: true, message: `Not sent: ${r.reason}` });
        return fail(`Approved, but it did not send: ${r.reason}. It will be tried again on the next run.`, 502);
      }
      case 'drop': {
        if (offer.status !== 'ready') return fail('Only an offer waiting for approval can be changed');
        const ids: string[] = offer.custom_image_ids ?? [];
        if (!imageId || !ids.includes(imageId)) return fail('That picture is not in this offer');
        if (ids.length - 1 < MIN_PICTURES) return fail('An offer needs at least 2 pictures. Use "Paint a different one" instead.');
        await supabase.from('preview_offers').update({
          custom_image_ids: ids.filter(x => x !== imageId), designs: (offer.designs ?? []).filter((d: any) => d.customImageId !== imageId),
        }).eq('id', id).eq('status', 'ready');
        return NextResponse.json({ ok: true });
      }
      case 'replace': {
        const settings = await loadOfferSettings();
        if (!settings.enabled) return fail('Offers are switched off, so nothing is painted');
        if (await offersDayUsage(supabase, Date.now()) >= settings.perDay) return fail(`Today's limit of ${settings.perDay} has been reached`, 429);
        const r = await replacePicture(supabase, id, imageId ?? '');
        return r.ok ? NextResponse.json({ ok: true }) : fail(r.error);
      }
      case 'skip': {
        if (!['queued', 'ready', 'approved', 'failed'].includes(offer.status)) return fail('That offer cannot be skipped now');
        await supabase.from('preview_offers').update({ status: 'skipped', error: 'Skipped by you' }).eq('id', id).eq('status', offer.status);
        return NextResponse.json({ ok: true });
      }
      case 'stop': {
        await supabase.from('preview_email_requests').update({ offers_stopped_at: new Date().toISOString() }).eq('email', offer.email);
        // A buyer may have no preview request at all: their photo opt-out stops photo offers too (needs the second migration; without it buyers cannot be offered anything)
        await supabase.from('email_preferences').update({ photo_offers_opt_out_at: new Date().toISOString() }).eq('email', offer.email).is('photo_offers_opt_out_at', null);
        if (['queued', 'ready', 'approved', 'failed'].includes(offer.status)) await supabase.from('preview_offers').update({ status: 'skipped', error: 'Offers stopped for this person' }).eq('id', id).eq('status', offer.status);
        return NextResponse.json({ ok: true });
      }
      case 'retry': {
        if (offer.status !== 'failed') return fail('Only a failed offer can be tried again');
        await supabase.from('preview_offers').update({ status: 'queued', error: null, designs: [], custom_image_ids: [], due_at: new Date().toISOString() }).eq('id', id).eq('status', 'failed');
        return NextResponse.json({ ok: true });
      }
      default:
        return fail('Unknown action');
    }
  } catch (e: any) {
    console.error('admin offers action failed', action, e);
    return fail(e?.message || 'Something went wrong', 500);
  }
}
