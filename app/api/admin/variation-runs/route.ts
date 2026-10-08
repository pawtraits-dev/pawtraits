import { NextRequest, NextResponse, after } from 'next/server';
import { requireAdmin, serviceClient } from '@/lib/qr/server';
import { createRun, planRun, tick } from '@/lib/variations/batch';
import type { Recipe } from '@/lib/variations/combos';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Runs, newest first, with counts and the cost recorded so far */
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  const supabase = serviceClient();
  const { data: runs, error } = await supabase.from('variation_runs').select('*').order('created_at', { ascending: false }).limit(50);
  if (error) return NextResponse.json({ error: /variation_runs/.test(error.message) ? 'Run db/migrations/2026-10-17-variation-batches.sql first.' : error.message }, { status: 500 });
  const ids = (runs ?? []).map((r: any) => r.id);
  const [counts, costs] = await Promise.all([
    ids.length ? supabase.from('variation_run_counts').select('*').in('run_id', ids) : Promise.resolve({ data: [] as any[] }),
    ids.length ? supabase.from('ai_usage').select('batch_job_id, cost_usd').in('batch_job_id', ids).limit(20000) : Promise.resolve({ data: [] as any[] }),
  ]);
  const countBy = new Map((counts.data ?? []).map((c: any) => [c.run_id, c]));
  const costBy = new Map<string, number>();
  for (const c of costs.data ?? []) costBy.set(c.batch_job_id, (costBy.get(c.batch_job_id) ?? 0) + Number(c.cost_usd ?? 0));
  return NextResponse.json((runs ?? []).map((r: any) => ({ ...r, counts: countBy.get(r.id) ?? null, cost_usd: Math.round((costBy.get(r.id) ?? 0) * 10000) / 10000 })));
}

/**
 * Start a run: { recipeId | recipe: { breed_coats, outfit_ids }, referenceIds, imageSize, name?, dryRun? }.
 * dryRun returns what would be made (per reference, skipping combinations already made) and the estimate.
 */
export async function POST(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const body = await request.json().catch(() => null);
  const supabase = serviceClient();

  let recipe: Recipe;
  let recipeId: string | null = null;
  let name = String(body?.name ?? '').trim();
  let imageSize = ['1K', '2K', '4K'].includes(body?.imageSize) ? body.imageSize : null;
  if (body?.recipeId) {
    const { data: r } = await supabase.from('variation_recipes').select('*').eq('id', body.recipeId).maybeSingle();
    if (!r) return NextResponse.json({ error: 'Saved batch not found' }, { status: 404 });
    recipe = { breedCoats: r.breed_coats ?? [], outfitIds: r.outfit_ids ?? [] };
    recipeId = r.id;
    name ||= r.name;
    imageSize ||= r.image_size;
  } else {
    recipe = {
      breedCoats: (body?.recipe?.breed_coats ?? []).filter((b: any) => UUID.test(b?.breedId) && UUID.test(b?.coatId)),
      outfitIds: (body?.recipe?.outfit_ids ?? []).filter((id: any) => UUID.test(id)),
    };
    name ||= 'Variations';
  }
  imageSize ||= '4K';
  const referenceIds: string[] = Array.from(new Set<string>((body?.referenceIds ?? []).filter((id: any) => UUID.test(id)))).slice(0, 200);
  if (!referenceIds.length) return NextResponse.json({ error: 'Choose at least one reference design' }, { status: 400 });
  if (!recipe.breedCoats.length && !recipe.outfitIds.length) return NextResponse.json({ error: 'The batch is empty' }, { status: 400 });

  try {
    if (body?.dryRun) return NextResponse.json(await planRun(supabase, recipe, referenceIds, imageSize));
    const { run, planned } = await createRun(supabase, { recipe, recipeId, name, refIds: referenceIds, imageSize, targetAge: body?.targetAge });
    if (!run) return NextResponse.json({ error: 'Nothing to make: every combination already exists for these designs', planned }, { status: 409 });
    // Submit straight away rather than waiting for the next cron tick
    after(() => tick(serviceClient(), 200_000).catch((e) => console.error('Batch tick after create failed:', e)));
    return NextResponse.json({ run, planned });
  } catch (e: any) {
    console.error('Variation run failed to start:', e);
    return NextResponse.json({ error: e?.message || 'Could not start the batch' }, { status: 500 });
  }
}
