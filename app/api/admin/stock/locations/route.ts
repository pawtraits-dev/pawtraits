/**
 * Stock / point-of-sale locations.
 * GET    /api/admin/stock/locations?activeOnly=true
 * POST   { code, name, location_type, address?, notes?, at_market_discount_pct? }
 * PATCH  { id, ...fields }   (code is immutable once created — it's printed on stickers)
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, serviceClient } from '@/lib/qr/server';
import { normaliseLocationCode } from '@/lib/qr/sticker-url';

export const dynamic = 'force-dynamic';

const TYPES = ['studio', 'stall', 'partner', 'other'];
const EDITABLE = ['name', 'location_type', 'address', 'notes', 'at_market_discount_pct', 'is_active', 'partner_id'] as const;

export async function GET(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  let q = serviceClient().from('stock_locations').select('*').order('code');
  if (request.nextUrl.searchParams.get('activeOnly') === 'true') q = q.eq('is_active', true);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const body = await request.json();
  const code = normaliseLocationCode(body.code);
  if (!code) return NextResponse.json({ error: 'Code must be 2–8 letters/numbers, e.g. CAMDEN' }, { status: 400 });
  if (!body.name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  if (!TYPES.includes(body.location_type)) return NextResponse.json({ error: 'Invalid location type' }, { status: 400 });

  const { data, error } = await serviceClient()
    .from('stock_locations')
    .insert({
      code,
      name: body.name.trim(),
      location_type: body.location_type,
      address: body.address || null,
      notes: body.notes || null,
      at_market_discount_pct: Number(body.at_market_discount_pct) || 0,
    })
    .select()
    .single();
  if (error) {
    const msg = error.code === '23505' ? `Location code ${code} already exists` : error.message;
    return NextResponse.json({ error: msg }, { status: error.code === '23505' ? 409 : 500 });
  }
  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const body = await request.json();
  if (!body.id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
  if (body.location_type && !TYPES.includes(body.location_type)) {
    return NextResponse.json({ error: 'Invalid location type' }, { status: 400 });
  }
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const k of EDITABLE) if (k in body) updates[k] = body[k];

  const { data, error } = await serviceClient().from('stock_locations').update(updates).eq('id', body.id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
