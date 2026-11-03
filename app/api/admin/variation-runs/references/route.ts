import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, serviceClient } from '@/lib/qr/server';
import { plainTitle } from '@/lib/variations/combos';
import { onlyOriginals } from '@/lib/catalog/originals';

export const dynamic = 'force-dynamic';

/**
 * Reference designs to run a batch on: ?q= (description/prompt) or ?ids=, newest first, 60 a page
 * (?page=). ?animal=dog|cat narrows to dogs or cats. ?originals=1 (the default) leaves out versions made from another design (breed / coat /
 * outfit / format variations, team versions, quiz pictures), so batches vary the original.
 */
const PAGE = 60;
export async function GET(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const sp = new URL(request.url).searchParams;
  const q = (sp.get('q') ?? '').trim().replace(/[%,()*]/g, ' ').slice(0, 60);
  const ids = (sp.get('ids') ?? '').split(',').filter(Boolean).slice(0, 200);
  const page = Math.max(0, Number(sp.get('page')) || 0);
  const originals = sp.get('originals') !== '0';
  let query = serviceClient().from('image_catalog')
    .select('id, description, prompt_text, public_url, image_variants, cloudinary_public_id, subject_count, is_public, breeds(name), themes(name)', { count: 'exact' })
    .not('is_customer_generated', 'is', true)
    .order('created_at', { ascending: false });
  if (ids.length) query = query.in('id', ids);
  else {
    query = query.range(page * PAGE, page * PAGE + PAGE - 1);
    if (q) query = query.or(`description.ilike.%${q}%,prompt_text.ilike.%${q}%`);
    // ?animal=dog|cat: designs with a pet of that kind (main pet or any pet of a multi-pet design)
    const animal = sp.get('animal');
    if (animal === 'dog' || animal === 'cat') {
      const db = serviceClient();
      const { data: bs } = await db.from('breeds').select('id').eq('animal_type', animal);
      const breedIds = (bs ?? []).map((b: any) => b.id);
      const ids = breedIds.length ? breedIds : ['00000000-0000-0000-0000-000000000000'];
      const { data: subs } = await db.from('image_catalog_subjects').select('image_catalog_id').in('breed_id', ids).limit(5000);
      const viaSubjects = Array.from(new Set((subs ?? []).map((r: any) => r.image_catalog_id))).slice(0, 800);
      query = viaSubjects.length ? query.or(`breed_id.in.(${ids.join(',')}),id.in.(${viaSubjects.join(',')})`) : query.in('breed_id', ids);
    }
    if (originals) {
      query = onlyOriginals(query);
    }
  }
  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const cloud = process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const rows = (data ?? []).map((r: any) => ({
    id: r.id,
    title: plainTitle(r.description || r.prompt_text),
    // Straight from Cloudinary: uploads' stored thumbnail links don't always load (variations' do)
    thumb: r.cloudinary_public_id && cloud ? `https://res.cloudinary.com/${cloud}/image/upload/c_fill,w_240,h_240,g_auto/f_auto,q_auto/${r.cloudinary_public_id}` : r.image_variants?.thumbnail?.url || r.public_url,
    breed: r.breeds?.name ?? null,
    theme: r.themes?.name ?? null,
    pets: r.subject_count ?? 1,
    is_public: r.is_public,
    has_prompt: !!r.prompt_text,
  }));
  // ?ids= keeps the old plain-list answer; searches say how many there are, for "Load more"
  return NextResponse.json(ids.length || sp.get('paged') !== '1' ? rows : { rows, total: count ?? rows.length, page, pageSize: PAGE });
}
