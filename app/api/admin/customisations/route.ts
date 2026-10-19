import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, serviceClient } from '@/lib/qr/server';
import { breedSource, loadOutcomes, wasShared } from '@/lib/admin/customisation-stats';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f-]{36}$/i;
const PAGE = 48;

/**
 * GET /api/admin/customisations?page=0&status=&design=&breed=&source=&purchased=yes&shared=yes&q=
 * Customisations newest first, with the design, breed, and whether each was bought and shared.
 * breed=unknown: no breed yet. q: email or pet name.
 */
export async function GET(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const p = new URL(request.url).searchParams;
  const page = Math.max(0, Number(p.get('page')) || 0);
  const supabase = serviceClient();

  let query = supabase.from('customer_custom_images')
    .select('id, created_at, status, error_message, customer_email, guest_session_id, pet_name, pet_image_url, generated_image_url, catalog_image_id, pet_breed_id, share_count, last_shared_at, rating, metadata', { count: 'exact' })
    .order('created_at', { ascending: false });

  const status = p.get('status');
  if (status && ['pending', 'generating', 'complete', 'failed'].includes(status)) query = query.eq('status', status);
  const design = p.get('design');
  if (design && UUID.test(design)) query = query.eq('catalog_image_id', design);
  const breed = p.get('breed');
  if (breed === 'unknown') query = query.is('pet_breed_id', null);
  else if (breed && UUID.test(breed)) query = query.eq('pet_breed_id', breed);
  const source = p.get('source');
  if (source && /^[a-z0-9_-]{1,32}$/.test(source)) query = query.eq('metadata->>source', source);
  const q = (p.get('q') || '').trim().replace(/[%,()]/g, '');
  if (q) query = query.or(`customer_email.ilike.%${q}%,pet_name.ilike.%${q}%`);

  // Bought / shared: narrow to the ids that were (paid order lines, share taps or link visits)
  if (p.get('purchased') === 'yes') {
    const { data: paid } = await supabase.from('orders').select('id').eq('payment_status', 'paid').order('created_at', { ascending: false }).limit(5000);
    const orderIds = (paid ?? []).map(o => o.id);
    const imageIds = new Set<string>();
    for (let i = 0; i < orderIds.length; i += 200) {
      const { data } = await supabase.from('order_items').select('image_id').in('order_id', orderIds.slice(i, i + 200));
      for (const l of data ?? []) if (UUID.test(l.image_id)) imageIds.add(l.image_id);
    }
    query = query.in('id', Array.from(imageIds).slice(0, 1000).concat(['00000000-0000-0000-0000-000000000000']));
  }
  if (p.get('shared') === 'yes') {
    const { data: ev } = await supabase.from('custom_image_events').select('custom_image_id').eq('event', 'share').limit(5000);
    const ids = Array.from(new Set((ev ?? []).map(e => e.custom_image_id))).slice(0, 500);
    query = ids.length ? query.or(`share_count.gt.0,id.in.(${ids.join(',')})`) : query.gt('share_count', 0);
  }

  const { data: rows, count, error } = await query.range(page * PAGE, page * PAGE + PAGE - 1);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const list = rows ?? [];
  const designIds = Array.from(new Set(list.map(r => r.catalog_image_id).filter(Boolean))) as string[];
  const breedIds = Array.from(new Set(list.map(r => r.pet_breed_id).filter(Boolean))) as string[];
  const [outcomes, designs, breeds] = await Promise.all([
    loadOutcomes(supabase, list),
    designIds.length ? supabase.from('image_catalog').select('id, description, cloudinary_public_id, public_url').in('id', designIds) : Promise.resolve({ data: [] as any[] }),
    breedIds.length ? supabase.from('breeds').select('id, name, animal_type').in('id', breedIds) : Promise.resolve({ data: [] as any[] }),
  ]);
  const designById = new Map((designs.data ?? []).map((d: any) => [d.id, d]));
  const breedById = new Map((breeds.data ?? []).map((b: any) => [b.id, b]));
  const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME;

  return NextResponse.json({
    total: count ?? 0,
    page,
    pageSize: PAGE,
    items: list.map(r => {
      const d: any = r.catalog_image_id ? designById.get(r.catalog_image_id) : null;
      const b: any = r.pet_breed_id ? breedById.get(r.pet_breed_id) : null;
      const o = outcomes.get(r.id);
      const m: any = r.metadata ?? {};
      return {
        id: r.id,
        createdAt: r.created_at,
        status: r.status,
        error: r.error_message,
        who: r.customer_email || 'guest',
        isGuest: !r.customer_email,
        petName: r.pet_name,
        petPhoto: r.pet_image_url,
        result: r.generated_image_url,
        design: d ? {
          id: d.id,
          title: (d.description || '').match(/\*\*(.+?)\*\*/)?.[1]?.trim() || 'Untitled design',
          thumb: d.cloudinary_public_id && cloud ? `https://res.cloudinary.com/${cloud}/image/upload/c_fill,g_auto,w_160,h_200,f_auto,q_auto/${d.cloudinary_public_id}` : d.public_url,
        } : null,
        breed: b ? b.name : m.detected_breed?.name ?? null,
        breedSource: breedSource(r),
        source: m.source ?? null,
        rating: r.rating,
        purchased: !!o?.purchased,
        revenue: o?.revenue ?? {},
        shared: wasShared(o),
        shares: o?.shares ?? 0,
        views: o?.views ?? 0,
      };
    }),
  });
}
