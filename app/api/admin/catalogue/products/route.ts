/**
 * Product catalogue (admin).
 * GET  → products with UK price, unit costs and margin
 * POST → create a product (+ its UK price)
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, serviceClient } from '@/lib/qr/server';
import { listCatalogueProducts, createCatalogueProduct, CatalogueError } from '@/lib/products/catalogue-admin';

export const dynamic = 'force-dynamic';

function fail(e: any) {
  const status = e instanceof CatalogueError ? e.status : 500;
  if (status >= 500) console.error('Catalogue API error:', e);
  return NextResponse.json({ error: e?.message || 'Something went wrong' }, { status });
}

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    return NextResponse.json(await listCatalogueProducts(serviceClient()));
  } catch (e) { return fail(e); }
}

export async function POST(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const body = await request.json();
    return NextResponse.json(await createCatalogueProduct(serviceClient(), body), { status: 201 });
  } catch (e) { return fail(e); }
}
