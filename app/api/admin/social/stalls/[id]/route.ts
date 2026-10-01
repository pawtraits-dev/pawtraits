/**
 * PATCH /api/admin/social/stalls/[id]  { town, country? }
 * Town shown for orders taken at this stall ("Old Spitalfields Market, London").
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, serviceClient } from '@/lib/qr/server';
import { cleanTown, countryLabel } from '@/lib/social/privacy';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const town = body.town ? cleanTown(String(body.town)) : null;
  if (body.town && !town) return NextResponse.json({ error: 'Town: letters only, up to 40 characters' }, { status: 400 });
  const country = body.country ? countryLabel(String(body.country)) : 'UK';
  const { data, error } = await serviceClient().from('stock_locations').update({ town, country, updated_at: new Date().toISOString() })
    .eq('id', id).select('id, name, town, country').maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(data);
}
