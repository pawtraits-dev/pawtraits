import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, serviceClient } from '@/lib/qr/server';
import { plainTitle } from '@/lib/variations/combos';

export const dynamic = 'force-dynamic';

/** Reference designs to run a batch on: ?q= (description/prompt) or ?ids= */
export async function GET(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const sp = new URL(request.url).searchParams;
  const q = (sp.get('q') ?? '').trim().replace(/[%,()]/g, ' ').slice(0, 60);
  const ids = (sp.get('ids') ?? '').split(',').filter(Boolean).slice(0, 200);
  let query = serviceClient().from('image_catalog')
    .select('id, description, prompt_text, public_url, image_variants, subject_count, is_public, breeds(name), themes(name)')
    .not('is_customer_generated', 'is', true)
    .order('created_at', { ascending: false })
    .limit(48);
  if (ids.length) query = query.in('id', ids);
  else if (q) query = query.or(`description.ilike.%${q}%,prompt_text.ilike.%${q}%`);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json((data ?? []).map((r: any) => ({
    id: r.id,
    title: plainTitle(r.description || r.prompt_text),
    thumb: r.image_variants?.thumbnail?.url || r.public_url,
    breed: r.breeds?.name ?? null,
    theme: r.themes?.name ?? null,
    pets: r.subject_count ?? 1,
    is_public: r.is_public,
    has_prompt: !!r.prompt_text,
  })));
}
