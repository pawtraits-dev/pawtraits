import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, serviceClient } from '@/lib/qr/server';
import { detectPetBreed } from '@/lib/customise/detect-breed';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/** Finished customisations whose pet breed isn't known and hasn't been tried yet (breed and coat are both asked) */
function pending(supabase: ReturnType<typeof serviceClient>, head = false) {
  return supabase.from('customer_custom_images')
    .select('id', head ? { count: 'exact', head: true } : undefined)
    .eq('status', 'complete')
    .is('pet_breed_id', null)
    .is('metadata->detected_breed', null);
}

/**
 * Finished customisations that have a breed (saved pet, or detected earlier) but no coat and no coat attempt yet.
 * Two queries because the breed is either a column (pet_breed_id) or only in metadata (an unmatched detection).
 */
function pendingCoat(supabase: ReturnType<typeof serviceClient>, kind: 'saved' | 'detected', head = false) {
  const q = supabase.from('customer_custom_images')
    .select('id', head ? { count: 'exact', head: true } : undefined)
    .eq('status', 'complete')
    .is('pet_coat_id', null)
    .is('metadata->detected_coat', null);
  return kind === 'saved'
    ? q.not('pet_breed_id', 'is', null)
    : q.is('pet_breed_id', null).not('metadata->detected_breed', 'is', null);
}

/** GET → { remaining, breedsRemaining, coatsRemaining }   (customisations still to look at) */
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  const supabase = serviceClient();
  const [a, b, c] = await Promise.all([pending(supabase, true), pendingCoat(supabase, 'saved', true), pendingCoat(supabase, 'detected', true)]);
  const error = a.error || b.error || c.error;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const breedsRemaining = a.count ?? 0, coatsRemaining = (b.count ?? 0) + (c.count ?? 0);
  return NextResponse.json({ remaining: breedsRemaining + coatsRemaining, breedsRemaining, coatsRemaining });
}

/**
 * POST { limit?: number }  → { tried, matched, unmatched, failed, coatOnly, remaining }
 * Looks at up to `limit` (default 10, max 20) customisations, five at a time: first those with no breed (breed and
 * coat from the photo), then those with a breed but no coat (coat only; the breed is never changed). For coat-only
 * rows `matched` / `unmatched` refer to the coat. The admin page calls it repeatedly until nothing is left.
 * About $0.004 each (Claude Haiku).
 */
export async function POST(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const body = await request.json().catch(() => ({}));
  const limit = Math.max(1, Math.min(Number(body?.limit) || 10, 20));
  const supabase = serviceClient();

  const jobs: { id: string; coatOnly: boolean }[] = [];
  const take = async (q: PromiseLike<{ data: any[] | null; error: { message: string } | null }>, coatOnly: boolean) => {
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    for (const r of data ?? []) jobs.push({ id: r.id as string, coatOnly });
  };
  try {
    await take(pending(supabase).order('created_at', { ascending: false }).limit(limit), false);
    if (jobs.length < limit) await take(pendingCoat(supabase, 'saved').order('created_at', { ascending: false }).limit(limit - jobs.length), true);
    if (jobs.length < limit) await take(pendingCoat(supabase, 'detected').order('created_at', { ascending: false }).limit(limit - jobs.length), true);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }

  const result = { tried: 0, matched: 0, unmatched: 0, failed: 0, coatOnly: 0 };
  for (let i = 0; i < jobs.length; i += 5) {
    const batch = jobs.slice(i, i + 5);
    const outcomes = await Promise.all(batch.map(j => detectPetBreed(j.id, supabase, { fillCoat: true })));
    outcomes.forEach((o, k) => {
      result.tried += 1;
      if (batch[k].coatOnly) result.coatOnly += 1;
      if (o === 'matched') result.matched += 1;
      else if (o === 'unmatched') result.unmatched += 1;
      else if (o === 'failed') result.failed += 1;
    });
  }
  const [a, b, c] = await Promise.all([pending(supabase, true), pendingCoat(supabase, 'saved', true), pendingCoat(supabase, 'detected', true)]);
  return NextResponse.json({ ...result, remaining: (a.count ?? 0) + (b.count ?? 0) + (c.count ?? 0) });
}
