/**
 * Phone cases (admin). Plan: claude/phone-cases-plan.md
 * GET                          layout groups (camera zones) and models, with each model's product and price
 * PATCH { id, is_active }      show or hide a model in the phone-case dropdowns
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, serviceClient } from '@/lib/qr/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  const db = serviceClient();
  const [groups, models] = await Promise.all([
    db.from('phone_layout_groups').select('*').order('id'),
    db.from('phone_models').select('*, product:products(id, sku, is_active, pricing:product_pricing(sale_price, product_cost, is_current, country_code))').order('display_order'),
  ]);
  if (groups.error || models.error) {
    const msg = (groups.error || models.error)!.message;
    const missing = /relation .* does not exist|Could not find the table/i.test(msg);
    return NextResponse.json({ error: missing ? 'Run db/migrations/2026-11-11-phone-cases.sql first.' : msg }, { status: missing ? 409 : 500 });
  }
  const out = (models.data ?? []).map((m: any) => {
    const price = (m.product?.pricing ?? []).find((p: any) => p.is_current !== false && p.country_code === 'GB');
    return {
      ...m, product: undefined,
      sku: m.product?.sku ?? null, product_active: m.product?.is_active ?? false,
      price_pence: price?.sale_price ?? null, cost_pence: price?.product_cost ?? null,
    };
  });
  return NextResponse.json({ groups: groups.data, models: out });
}

export async function PATCH(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const body = await req.json().catch(() => ({}));
  if (typeof body.id !== 'string' || typeof body.is_active !== 'boolean') return NextResponse.json({ error: 'id and is_active are required' }, { status: 400 });
  const { data, error } = await serviceClient().from('phone_models').update({ is_active: body.is_active, updated_at: new Date().toISOString() }).eq('id', body.id).select('id, is_active').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
