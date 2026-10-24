import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, serviceClient } from '@/lib/qr/server';
import { plainTitle } from '@/lib/variations/combos';

export const dynamic = 'force-dynamic';

/**
 * Reference designs to run a batch on: ?q= (description/prompt) or ?ids=, newest first, 60 a page
 * (?page=). ?originals=1 (the default) leaves out versions made from another design (breed / coat /
 * outfit / format variations, team versions, quiz pictures), so batches vary the original.
 */
const PAGE = 60;
const VERSION_TAGS = '{variation,team-variant,batch-generated,quiz-generated}';
export async function GET(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const sp = new URL(request.url).searchParams;
  const q = (sp.get('q') ?? '').trim().replace(/[%,()*]/g, ' ').slice(0, 60);
  const ids = (sp.get('ids') ?? '').split(',').filter(Boolean).slice(0, 200);
  const page = Math.max(0, Number(sp.get('page')) || 0);
  const originals = sp.get('originals') !== '0';
  let query = serviceClient().from('image_catalog')
    .select('id, description, prompt_text, public_url, image_variants, subject_count, is_public, breeds(name), themes(name)', { count: 'exact' })
    .not('is_customer_generated', 'is', true)
    .order('created_at', { ascending: false });
  if (ids.length) query = query.in('id', ids);
  else {
    query = query.range(page * PAGE, page * PAGE + PAGE - 1);
    if (q) query = query.or(`description.ilike.%${q}%,prompt_text.ilike.%${q}%`);
    if (originals) {
      // Linked versions (variation_of, since 17 Oct), and older ones by their tags and folders
      query = query.is('variation_of', null)
        .or(`tags.is.null,not.tags.ov.${VERSION_TAGS}`)
        .or('cloudinary_public_id.is.null,and(cloudinary_public_id.not.like.pawtraits/variations/*,cloudinary_public_id.not.like.pawtraits/team-versions/*,cloudinary_public_id.not.like.pawtraits/variation-previews/*)');
    }
  }
  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const rows = (data ?? []).map((r: any) => ({
    id: r.id,
    title: plainTitle(r.description || r.prompt_text),
    thumb: r.image_variants?.thumbnail?.url || r.public_url,
    breed: r.breeds?.name ?? null,
    theme: r.themes?.name ?? null,
    pets: r.subject_count ?? 1,
    is_public: r.is_public,
    has_prompt: !!r.prompt_text,
  }));
  // ?ids= keeps the old plain-list answer; searches say how many there are, for "Load more"
  return NextResponse.json(ids.length || sp.get('paged') !== '1' ? rows : { rows, total: count ?? rows.length, page, pageSize: PAGE });
}
