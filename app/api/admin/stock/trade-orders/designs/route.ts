/**
 * GET /api/admin/stock/trade-orders/designs?q=&page=
 * Catalogue designs to add to a trade print order (listed, public designs; newest first).
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, serviceClient } from '@/lib/qr/server';
import { LISTED_ONLY } from '@/lib/catalog/listing';

export const dynamic = 'force-dynamic';
const PAGE = 36;

export async function GET(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const q = (request.nextUrl.searchParams.get('q') || '').trim().replace(/[%,()]/g, '').slice(0, 60);
  const page = Math.max(0, Number(request.nextUrl.searchParams.get('page')) || 0);
  let query = serviceClient().from('image_catalog').select('id, description, cloudinary_public_id, public_url, breeds:breed_id (name)', { count: 'exact' })
    .eq('is_public', true).or(LISTED_ONLY).not('is_customer_generated', 'is', true)
    .order('created_at', { ascending: false }).range(page * PAGE, page * PAGE + PAGE - 1);
  if (q) query = query.ilike('description', `%${q}%`);
  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const cloud = process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  return NextResponse.json({
    total: count ?? 0, page, pageSize: PAGE,
    designs: (data ?? []).map((d: any) => ({
      id: d.id,
      title: (d.description || '').match(/\*\*(.+?)\*\*/)?.[1]?.trim() || 'Untitled design',
      breed: (Array.isArray(d.breeds) ? d.breeds[0] : d.breeds)?.name ?? null,
      thumb: d.cloudinary_public_id && cloud ? `https://res.cloudinary.com/${cloud}/image/upload/c_fill,w_160,h_200,g_auto/f_auto,q_auto/${d.cloudinary_public_id}` : d.public_url,
    })),
  });
}
