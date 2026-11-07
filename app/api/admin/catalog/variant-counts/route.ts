/**
 * GET /api/admin/catalog/variant-counts?ids=a,b,c — for each design, how many versions were made
 * from it: breed / coat / outfit / format variations (image_catalog.variation_of) and finished
 * team versions (design_team_variants). Admin → Catalogue shows these on the cards.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, serviceClient } from '@/lib/qr/server';

export const dynamic = 'force-dynamic';
const UUID = /^[0-9a-f-]{36}$/i;

export async function GET(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const ids = (request.nextUrl.searchParams.get('ids') || '').split(',').filter(id => UUID.test(id)).slice(0, 200);
  if (!ids.length) return NextResponse.json({ counts: {} });
  const supabase = serviceClient();
  const [{ data: vars }, { data: teams }] = await Promise.all([
    supabase.from('image_catalog').select('variation_of').in('variation_of', ids).not('is_customer_generated', 'is', true).limit(20_000),
    supabase.from('design_team_variants').select('source_image_id').in('source_image_id', ids).eq('status', 'done').not('image_id', 'is', null).limit(20_000),
  ]);
  const counts: Record<string, { variations: number; teams: number }> = {};
  for (const v of vars ?? []) (counts[v.variation_of] ??= { variations: 0, teams: 0 }).variations++;
  for (const t of teams ?? []) (counts[t.source_image_id] ??= { variations: 0, teams: 0 }).teams++;
  return NextResponse.json({ counts });
}
