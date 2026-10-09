/**
 * Instagram carousels (server only). Featured items fill batches of 5 in the order they happened;
 * each batch is a 10-slide carousel: photo → Pawtrait for each pet, every slide 1080×1350 (4:5).
 * Photos are filled to the frame centred on the pet; Pawtraits are fitted whole with a blurred
 * fill (nothing cropped) and watermarked. A full batch becomes 'ready' (phase 4 publishes it).
 */
import { blurredFit } from '@/lib/social/feed';
import { getSetting } from '@/lib/app-settings';

export const BATCH_SIZE = 5;
const W = 1080, H = 1350;

function cloud() {
  return process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || '';
}

export function beforeSlide(publicId: string | null, fallback: string): string {
  const c = cloud();
  return c && publicId ? `https://res.cloudinary.com/${c}/image/upload/c_fill,g_auto,w_${W},h_${H}/f_jpg,q_90/${publicId}` : fallback;
}

export function afterSlide(publicId: string | null, fallback: string): string {
  const c = cloud();
  if (!c || !publicId) return fallback;
  const wm = process.env.CLOUDINARY_WATERMARK_PUBLIC_ID || 'pawtraits_watermark_logo';
  const op = parseInt(process.env.CLOUDINARY_WATERMARK_OPACITY || '20', 10);
  return `https://res.cloudinary.com/${c}/image/upload/${blurredFit(publicId, W, H)}/l_${wm},o_${op},g_center,w_0.6,fl_relative/f_jpg,q_90/${publicId}`;
}

/** Download version of a Cloudinary slide (adds fl_attachment) */
export function downloadUrl(url: string, name: string): string {
  return url.includes('res.cloudinary.com') ? url.replace('/image/upload/', `/image/upload/fl_attachment:${name}/`) : url;
}

export interface CaptionItem { petName: string | null; channel: 'online' | 'stall'; stallName: string | null; town: string | null }

const NUMBER_WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five'];
const join = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

/** The post caption: pet first names, then where they're from (stalls and towns), no personal details */
export function buildCaption(items: CaptionItem[]): string {
  const n = items.length;
  const names = items.map(i => i.petName).filter((x): x is string => !!x);
  const unnamed = n - names.length;
  const who = [...names, ...(unnamed === 1 ? ['one shy friend'] : unnamed > 1 ? [`${NUMBER_WORDS[unnamed]?.toLowerCase() ?? unnamed} shy friends`] : [])];
  const places = Array.from(new Set([
    ...items.filter(i => i.channel === 'stall' && i.stallName).map(i => i.stallName as string),
    ...items.filter(i => i.town).map(i => i.town as string),
  ])).slice(0, 4);

  const count = NUMBER_WORDS[n] ?? String(n);
  return [
    n === 1 ? 'One pet, one masterpiece 🎨🐾' : `${count} pets, ${count.toLowerCase()} masterpieces 🎨🐾`,
    `Swipe to watch ${join(who)} go from phone photo to Pawtrait 👉`,
    ...(places.length ? [`📍 ${places.join(' · ')}`] : []),
    'Want your pet painted? Free preview in about a minute at pawtraits.pics',
    '#pawtraits #petportrait #custompetportrait #petart #dogsofinstagram #catsofinstagram',
  ].join('\n\n');
}

const ELIGIBLE = { check_status: 'approved', opted_out: false, hidden: false, ig_excluded: false };

/**
 * Keeps unposted carousels up to date: drops pets that are no longer eligible (opted out, hidden,
 * removed from Instagram, previews when previews are off), then tops up the filling carousel with
 * the oldest featured pets not yet in one. Full carousels become 'ready'. Never throws.
 */
export async function fillBatches(supabase: any): Promise<void> {
  try {
    const includePreviews = await getSetting('social_include_previews');
    const { data: open } = await supabase.from('social_batches').select('id, status, caption_edited, created_at')
      .in('status', ['filling', 'ready']).order('created_at', { ascending: true });

    // 1. Drop pets that no longer qualify from unposted carousels
    const openIds = (open ?? []).map((b: any) => b.id);
    if (openIds.length) {
      const { data: members } = await supabase.from('social_items')
        .select('id, batch_id, source, check_status, opted_out, hidden, ig_excluded').in('batch_id', openIds);
      const drop = (members ?? []).filter((m: any) =>
        m.check_status !== 'approved' || m.opted_out || m.hidden || m.ig_excluded || (m.source === 'preview' && !includePreviews)).map((m: any) => m.id);
      if (drop.length) await supabase.from('social_items').update({ batch_id: null }).in('id', drop);
      // Carousels that aren't full give their pets back so everything regroups in order
      // (keeps a single filling carousel; full ones stay exactly as they are)
      const kept = (members ?? []).filter((m: any) => !drop.includes(m.id));
      const partial = openIds.filter((id: string) => kept.filter((m: any) => m.batch_id === id).length < BATCH_SIZE);
      if (partial.length) await supabase.from('social_items').update({ batch_id: null }).in('batch_id', partial);
    }

    // 2. Pets waiting for a carousel, oldest first
    let q = supabase.from('social_items').select('id').is('batch_id', null).match(ELIGIBLE)
      .order('paid_at', { ascending: true }).limit(200);
    if (!includePreviews) q = q.eq('source', 'purchase');
    const { data: waiting } = await q;
    const queue: string[] = (waiting ?? []).map((w: any) => w.id);

    // 3. Fill open carousels in order, then start new ones
    const batches = [...(open ?? [])];
    for (let i = 0; ; i++) {
      let batch = batches[i];
      const { count } = batch
        ? await supabase.from('social_items').select('id', { count: 'exact', head: true }).eq('batch_id', batch.id)
        : { count: 0 };
      const room = BATCH_SIZE - (count ?? 0);
      if (!batch && !queue.length) break;
      if (!batch) {
        const { data: created } = await supabase.from('social_batches').insert({ status: 'filling' }).select('id, status, caption_edited').single();
        batch = created; batches.push(batch);
      }
      const take = queue.splice(0, Math.max(0, room));
      if (take.length) await supabase.from('social_items').update({ batch_id: batch.id }).in('id', take).is('batch_id', null);
      await refreshBatch(supabase, batch.id, batch.caption_edited);
      if (!queue.length && i >= batches.length - 1) break;
    }
  } catch (err) {
    console.error('social fillBatches failed', err);
  }
}

/** Status ('filling' until 5) and the automatic caption (unless an admin edited it) */
export async function refreshBatch(supabase: any, batchId: string, captionEdited = false): Promise<void> {
  const { data: items } = await supabase.from('social_items')
    .select('id, pet_name, channel, stall_name, town, paid_at').eq('batch_id', batchId).order('paid_at', { ascending: true });
  const list = items ?? [];
  // Two captures at once can overfill: the newest extras go back to the queue
  if (list.length > BATCH_SIZE) {
    await supabase.from('social_items').update({ batch_id: null }).in('id', list.slice(BATCH_SIZE).map((i: any) => i.id));
    list.length = BATCH_SIZE;
  }
  if (!list.length) {
    await supabase.from('social_batches').delete().eq('id', batchId).in('status', ['filling', 'ready']);
    return;
  }
  await supabase.from('social_batches').update({
    status: list.length >= BATCH_SIZE ? 'ready' : 'filling',
    ...(captionEdited ? {} : { caption: buildCaption(list.map((i: any) => ({ petName: i.pet_name, channel: i.channel, stallName: i.stall_name, town: i.town }))) }),
    updated_at: new Date().toISOString(),
  }).eq('id', batchId).in('status', ['filling', 'ready']);
}
