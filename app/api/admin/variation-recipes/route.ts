import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, serviceClient } from '@/lib/qr/server';
import { recipeSize } from '@/lib/variations/combos';
import { cleanRecipeBody } from './shared';

export const dynamic = 'force-dynamic';

/** Saved variation batches: list and create */
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { data, error } = await serviceClient().from('variation_recipes').select('*').order('updated_at', { ascending: false });
  if (error) return NextResponse.json({ error: /variation_recipes/.test(error.message) ? 'Run db/migrations/2026-10-17-variation-batches.sql first.' : error.message }, { status: 500 });
  return NextResponse.json((data ?? []).map((r: any) => ({ ...r, per_reference: recipeSize({ breedCoats: r.breed_coats ?? [], outfitIds: r.outfit_ids ?? [] }) })));
}

export async function POST(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const clean = cleanRecipeBody(await request.json().catch(() => null));
  if ('error' in clean) return NextResponse.json({ error: clean.error }, { status: 400 });
  const { data, error } = await serviceClient().from('variation_recipes').insert(clean.row).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
