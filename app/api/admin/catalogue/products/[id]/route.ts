/**
 * One catalogue product (admin).
 * GET, PUT (full update incl. UK price), PATCH { is_active }, DELETE (deactivates if it has been ordered)
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, serviceClient } from '@/lib/qr/server';
import { getCatalogueProduct, updateCatalogueProduct, setCatalogueProductActive, deleteCatalogueProduct, CatalogueError } from '@/lib/products/catalogue-admin';

export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string }> };

function fail(e: any) {
  const status = e instanceof CatalogueError ? e.status : 500;
  if (status >= 500) console.error('Catalogue API error:', e);
  return NextResponse.json({ error: e?.message || 'Something went wrong' }, { status });
}

async function idFrom(ctx: Ctx) {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new CatalogueError('Invalid product id');
  return id;
}

export async function GET(_: NextRequest, ctx: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try { return NextResponse.json(await getCatalogueProduct(serviceClient(), await idFrom(ctx))); } catch (e) { return fail(e); }
}

export async function PUT(request: NextRequest, ctx: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try { return NextResponse.json(await updateCatalogueProduct(serviceClient(), await idFrom(ctx), await request.json())); } catch (e) { return fail(e); }
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const { is_active } = await request.json();
    if (typeof is_active !== 'boolean') throw new CatalogueError('is_active must be true or false');
    return NextResponse.json(await setCatalogueProductActive(serviceClient(), await idFrom(ctx), is_active));
  } catch (e) { return fail(e); }
}

export async function DELETE(_: NextRequest, ctx: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try { return NextResponse.json(await deleteCatalogueProduct(serviceClient(), await idFrom(ctx))); } catch (e) { return fail(e); }
}
