import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, serviceClient } from '@/lib/qr/server';
import { detectPetBreed } from '@/lib/customise/detect-breed';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/** Finished customisations whose pet breed isn't known and hasn't been tried yet */
function pending(supabase: ReturnType<typeof serviceClient>, head = false) {
  return supabase.from('customer_custom_images')
    .select('id', head ? { count: 'exact', head: true } : undefined)
    .eq('status', 'complete')
    .is('pet_breed_id', null)
    .is('metadata->detected_breed', null);
}

/** GET → { remaining }   (how many customisations still have no breed) */
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { count, error } = await pending(serviceClient(), true);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ remaining: count ?? 0 });
}

/**
 * POST { limit?: number }  → { tried, matched, unmatched, failed, remaining }
 * Detects the breed of the pet photo for up to `limit` (max 20) customisations, five at a time.
 * The admin page calls it repeatedly until nothing is left. About $0.004 each (Claude Haiku).
 */
export async function POST(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const body = await request.json().catch(() => ({}));
  const limit = Math.max(1, Math.min(Number(body?.limit) || 10, 20));
  const supabase = serviceClient();

  const { data, error } = await pending(supabase).order('created_at', { ascending: false }).limit(limit);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const result = { tried: 0, matched: 0, unmatched: 0, failed: 0 };
  const ids = (data ?? []).map((r: any) => r.id as string);
  for (let i = 0; i < ids.length; i += 5) {
    const outcomes = await Promise.all(ids.slice(i, i + 5).map(id => detectPetBreed(id, supabase)));
    for (const o of outcomes) {
      result.tried += 1;
      if (o === 'matched') result.matched += 1;
      else if (o === 'unmatched') result.unmatched += 1;
      else if (o === 'failed') result.failed += 1;
    }
  }
  const { count } = await pending(supabase, true);
  return NextResponse.json({ ...result, remaining: count ?? 0 });
}
