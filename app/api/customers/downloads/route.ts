/** GET /api/customers/downloads — the signed-in customer's digital downloads */
import { NextRequest, NextResponse } from 'next/server';
import { getRequester } from '@/lib/guest/access';
import { serviceClient } from '@/lib/qr/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { user } = await getRequester(request);
  if (!user) return NextResponse.json({ error: 'Please sign in' }, { status: 401 });

  const supabase = serviceClient();
  const { data: profile } = await supabase.from('user_profiles').select('customer_id').eq('user_id', user.id).maybeSingle();

  // Match on customer id, or on email for anything granted before the account existed
  let q = supabase
    .from('digital_entitlements')
    .select('id, source, status, created_at, unlocked_at, download_count, custom_image_id, catalog_image_id, order_id')
    .neq('status', 'revoked')
    .order('created_at', { ascending: false });
  q = profile?.customer_id
    ? q.or(`customer_id.eq.${profile.customer_id},email.eq.${(user.email || '').toLowerCase()}`)
    : q.eq('email', (user.email || '').toLowerCase());
  const { data: rows, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const customIds = (rows ?? []).map(r => r.custom_image_id).filter(Boolean);
  const catIds = (rows ?? []).map(r => r.catalog_image_id).filter(Boolean);
  const [{ data: customs }, { data: cats }] = await Promise.all([
    customIds.length ? supabase.from('customer_custom_images').select('id, generated_image_url, pet_name').in('id', customIds) : Promise.resolve({ data: [] as any[] }),
    catIds.length ? supabase.from('image_catalog').select('id, public_url, description').in('id', catIds) : Promise.resolve({ data: [] as any[] }),
  ]);
  const cMap = new Map((customs ?? []).map((c: any) => [c.id, c]));
  const kMap = new Map((cats ?? []).map((c: any) => [c.id, c]));

  return NextResponse.json((rows ?? []).map(r => {
    const c = r.custom_image_id ? cMap.get(r.custom_image_id) : null;
    const k = r.catalog_image_id ? kMap.get(r.catalog_image_id) : null;
    return {
      id: r.id,
      source: r.source,
      status: r.status,
      createdAt: r.created_at,
      downloadCount: r.download_count,
      title: c ? `${c.pet_name && c.pet_name !== 'Uploaded Pet' ? c.pet_name + '’s' : 'Your'} Pawtrait` : (k?.description?.slice(0, 60) || 'Pawtrait'),
      previewUrl: c?.generated_image_url ?? k?.public_url ?? null,
    };
  }));
}
