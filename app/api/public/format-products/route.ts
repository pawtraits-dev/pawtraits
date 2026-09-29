/**
 * GET /api/public/format-products?formatId=<uuid>&country=GB
 * Active products for one image format (prints + digital download) with current pricing
 * for the country. Replaces the non-existent /api/shop/products?formatId= and
 * /api/shop/pricing?formatId= the custom-portrait page was calling.
 */
import { NextRequest, NextResponse } from 'next/server';
import { serviceClient } from '@/lib/qr/server';

export const revalidate = 300;

export async function GET(request: NextRequest) {
  const formatId = request.nextUrl.searchParams.get('formatId');
  const country = (request.nextUrl.searchParams.get('country') || 'GB').toUpperCase();
  if (!formatId || !/^[0-9a-f-]{36}$/i.test(formatId)) return NextResponse.json({ error: 'formatId required' }, { status: 400 });

  const supabase = serviceClient();
  const { data: products, error } = await supabase
    .from('products')
    .select('*, medium:media(id, name, slug, description, category)')
    .eq('format_id', formatId)
    .eq('is_active', true);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ids = (products ?? []).map(p => p.id);
  const { data: pricing } = ids.length
    ? await supabase.from('product_pricing').select('*').in('product_id', ids).eq('country_code', country).eq('is_current', true)
    : { data: [] as any[] };

  const byProduct = new Map((pricing ?? []).map(p => [p.product_id, p]));
  const out = (products ?? [])
    .filter(p => byProduct.has(p.id))
    .map(p => ({ ...p, media_name: p.medium?.name, media_description: p.medium?.description, pricing: byProduct.get(p.id) }))
    .sort((a, b) => (a.product_type === 'digital_download' ? -1 : 0) - (b.product_type === 'digital_download' ? -1 : 0) || (a.pricing.sale_price - b.pricing.sale_price));

  return NextResponse.json({ products: out });
}
