/**
 * POST /api/cart/reprice  { productIds: string[] }
 * Current state of the products in a basket kept in the browser: whether each is still on sale,
 * and its current UK price. Lets the basket drop discontinued lines and show today's price.
 * Public (catalogue data only).
 */
import { NextRequest, NextResponse } from 'next/server';
import { serviceClient } from '@/lib/qr/server';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const ids: string[] = Array.from(new Set<string>((body?.productIds || []).filter((id: unknown) => typeof id === 'string' && UUID.test(id)))).slice(0, 100);
  if (!ids.length) return NextResponse.json({ products: {} });

  const supabase = serviceClient();
  const [{ data: products, error }, { data: pricing }] = await Promise.all([
    supabase.from('products').select('id, is_active, product_type, requires_shipping, name, size_name, size_code, width_cm, height_cm, shape_family, sku').in('id', ids),
    supabase.from('product_pricing').select('*').in('product_id', ids).eq('country_code', 'GB'),
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const out: Record<string, { active: boolean; pricing: any | null; product: any }> = {};
  for (const id of ids) {
    const p = (products || []).find(x => x.id === id);
    if (!p) { out[id] = { active: false, pricing: null, product: null }; continue; }
    const rows = (pricing || []).filter(r => r.product_id === id)
      .sort((a, b) => Number(b.is_current === true) - Number(a.is_current === true));
    out[id] = { active: p.is_active !== false, pricing: rows[0] || null, product: p };
  }
  return NextResponse.json({ products: out });
}
