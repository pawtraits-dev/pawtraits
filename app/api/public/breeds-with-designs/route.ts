/**
 * GET /api/public/breeds-with-designs[?animal=dog|cat]
 * Breeds that have at least one public catalogue design, most designs first, each with one
 * design id to use as its thumbnail. Breeds with no designs are left out (they'd be empty pages).
 */
import { NextRequest, NextResponse } from 'next/server';
import { serviceClient } from '@/lib/qr/server';

export const revalidate = 300;

export async function GET(request: NextRequest) {
  const animal = request.nextUrl.searchParams.get('animal');
  const supabase = serviceClient();

  const { data: images, error } = await supabase
    .from('image_catalog')
    .select('id, breed_id, rating, is_featured, created_at')
    .eq('is_public', true)
    .not('breed_id', 'is', null)
    .or('is_customer_generated.is.null,is_customer_generated.eq.false')
    .order('created_at', { ascending: false })
    .limit(2000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const byBreed = new Map<string, { count: number; imageId: string; score: number }>();
  for (const img of images ?? []) {
    const score = (img.is_featured ? 10 : 0) + (img.rating || 0);
    const cur = byBreed.get(img.breed_id);
    if (!cur) byBreed.set(img.breed_id, { count: 1, imageId: img.id, score });
    else { cur.count += 1; if (score > cur.score) { cur.imageId = img.id; cur.score = score; } }
  }
  if (!byBreed.size) return NextResponse.json({ breeds: [] });

  let q = supabase.from('breeds').select('id, name, slug, animal_type, popularity_rank, is_active').in('id', Array.from(byBreed.keys()));
  if (animal === 'dog' || animal === 'cat') q = q.eq('animal_type', animal);
  const { data: breeds, error: bErr } = await q;
  if (bErr) return NextResponse.json({ error: bErr.message }, { status: 500 });

  const out = (breeds ?? [])
    .filter(b => b.is_active !== false)
    .map(b => ({ id: b.id, name: b.name, slug: b.slug, animalType: b.animal_type, count: byBreed.get(b.id)!.count, imageId: byBreed.get(b.id)!.imageId, rank: b.popularity_rank ?? 9999 }))
    .sort((a, b) => b.count - a.count || a.rank - b.rank || a.name.localeCompare(b.name))
    .map(({ rank, ...b }) => b);

  return NextResponse.json({ breeds: out });
}
