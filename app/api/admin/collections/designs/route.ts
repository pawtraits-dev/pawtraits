/**
 * GET /api/admin/collections/designs?view=recent|untagged|failed|unsure|in&collection=<id>&q=&page=
 * The Tagging review list: designs with their tags, collections (and how each link was made)
 * and the tagger's confidence, plus progress counts.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, serviceClient } from '@/lib/qr/server';

export const dynamic = 'force-dynamic';
const PAGE = 24;
const VIEWS = ['recent', 'untagged', 'failed', 'unsure', 'in'] as const;
const NOT_CUSTOMER = 'is_customer_generated.is.null,is_customer_generated.eq.false';

function thumb(row: any): string {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  return cloud && row.cloudinary_public_id ? `https://res.cloudinary.com/${cloud}/image/upload/c_fill,w_240,h_240,g_auto/f_auto,q_auto/${row.cloudinary_public_id}` : row.public_url;
}

/** "**The King** A royal portrait" → "The King" */
function titleOf(description: string | null): string {
  const d = (description || '').trim();
  const bold = /^\*\*(.+?)\*\*/.exec(d)?.[1];
  return (bold || d.replace(/\*\*/g, '')).slice(0, 80) || 'Untitled design';
}

export async function GET(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const sp = request.nextUrl.searchParams;
  const view = (VIEWS as readonly string[]).includes(sp.get('view') || '') ? sp.get('view')! : 'recent';
  const page = Math.max(0, Number(sp.get('page')) || 0);
  const q = (sp.get('q') || '').trim().slice(0, 60).replace(/[%,()*]/g, ' ');
  const supabase = serviceClient();
  try {
    let ids: string[] | null = null;
    if (view === 'in') {
      const { data } = await supabase.from('design_collections').select('image_id').eq('collection_id', sp.get('collection') || '00000000-0000-0000-0000-000000000000').eq('excluded', false).limit(2000);
      ids = (data ?? []).map((r: any) => r.image_id);
    }
    let query = supabase.from('image_catalog')
      .select('id, description, cloudinary_public_id, public_url, display_tags, display_tags_edited, auto_tag, auto_tagged_at, auto_tag_error, created_at, breeds:breed_id (name), themes:theme_id (name)', { count: 'exact' })
      .or(NOT_CUSTOMER);
    if (view === 'untagged') query = query.is('auto_tagged_at', null).is('auto_tag_error', null);
    if (view === 'failed') query = query.not('auto_tag_error', 'is', null);
    if (view === 'unsure') query = query.lt('auto_tag->>confidence', '0.6').not('auto_tag', 'is', null);
    if (view === 'recent') query = query.not('auto_tagged_at', 'is', null);
    if (ids) query = query.in('id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);
    if (q) query = query.or(`description.ilike.%${q}%,display_tags.cs.{${q.toLowerCase()}}`);
    query = query.order(view === 'recent' ? 'auto_tagged_at' : 'created_at', { ascending: false }).range(page * PAGE, page * PAGE + PAGE - 1);
    const { data: rows, count, error } = await query;
    if (error) throw error;

    const rowIds = (rows ?? []).map((r: any) => r.id);
    const { data: links } = rowIds.length
      ? await supabase.from('design_collections').select('image_id, collection_id, source, excluded').in('image_id', rowIds)
      : { data: [] };
    const countWhere = async (f: (x: any) => any) => {
      const { count } = await f(supabase.from('image_catalog').select('id', { count: 'exact', head: true }).or(NOT_CUSTOMER));
      return count ?? 0;
    };
    const [total, untagged, failed] = await Promise.all([
      countWhere(x => x),
      countWhere(x => x.is('auto_tagged_at', null).is('auto_tag_error', null)),
      countWhere(x => x.not('auto_tag_error', 'is', null)),
    ]);
    return NextResponse.json({
      counts: { total, untagged, failed, tagged: Math.max(0, total - untagged - failed) },
      total: count ?? 0, page, pageSize: PAGE,
      designs: (rows ?? []).map((r: any) => ({
        id: r.id, title: titleOf(r.description), thumb: thumb(r), breed: r.breeds?.name ?? null, theme: r.themes?.name ?? null,
        tags: r.display_tags ?? [], tagsEdited: r.display_tags_edited, confidence: r.auto_tag?.confidence ?? null,
        taggedAt: r.auto_tagged_at, error: r.auto_tag_error,
        links: (links ?? []).filter((l: any) => l.image_id === r.id).map((l: any) => ({ collectionId: l.collection_id, source: l.source, excluded: l.excluded })),
      })),
    });
  } catch (e) {
    console.error('admin designs list failed', e);
    return NextResponse.json({ error: 'Could not load designs' }, { status: 500 });
  }
}
