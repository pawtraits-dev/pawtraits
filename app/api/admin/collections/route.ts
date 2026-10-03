/**
 * GET  /api/admin/collections — the whole tree (with design counts and season state) and themes
 *      with their collection mapping and a suggestion from the theme name.
 * POST /api/admin/collections — add a collection under a parent { parent_id, name, slug?, description? }
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, serviceClient } from '@/lib/qr/server';
import { adminTree, slugify } from '@/lib/collections/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    return NextResponse.json(await adminTree(serviceClient()));
  } catch (err) {
    console.error('admin collections GET failed', err);
    return NextResponse.json({ error: 'Could not load collections' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const body = await request.json().catch(() => ({}));
  const name = String(body.name ?? '').trim().slice(0, 80);
  const slug = slugify(String(body.slug || name));
  if (!name || !slug) return NextResponse.json({ error: 'Give the collection a name' }, { status: 400 });
  const supabase = serviceClient();
  try {
    const { data: parent } = await supabase.from('collections').select('id, kind, path, depth').eq('id', body.parent_id).maybeSingle();
    if (!parent) return NextResponse.json({ error: 'Choose where it goes (Occasions, Sports, …)' }, { status: 400 });
    if (parent.depth >= 2) return NextResponse.json({ error: 'Collections go at most three levels deep' }, { status: 400 });
    const { count } = await supabase.from('collections').select('id', { count: 'exact', head: true }).eq('parent_id', parent.id);
    const { data, error } = await supabase.from('collections').insert({
      kind: parent.kind, parent_id: parent.id, slug, path: `${parent.path}/${slug}`, depth: parent.depth + 1,
      name, description: String(body.description ?? '').trim().slice(0, 300) || null, sort_order: ((count ?? 0) + 1) * 10,
    }).select('id, path').single();
    if (error) {
      if (error.code === '23505') return NextResponse.json({ error: `There is already a "${slug}" there` }, { status: 409 });
      throw error;
    }
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error('admin collections POST failed', err);
    return NextResponse.json({ error: 'Could not add the collection' }, { status: 500 });
  }
}
