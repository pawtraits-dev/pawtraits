/**
 * Admin → Collections → Team versions → Team mottos.
 * GET   — every Premier League team with its motto (admin's wording, if any) and the default
 * PATCH { path, motto } — save a team's motto; empty / null goes back to the default
 * Mottos show as big text on personalised-kit designs that have "Show the team motto" ticked.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, serviceClient } from '@/lib/qr/server';
import { defaultMotto } from '@/lib/collections/sports-teams';
import { cleanSlogan, SLOGAN_MAX } from '@/lib/collections/slogan';

export const dynamic = 'force-dynamic';

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { data, error } = await serviceClient().from('collections').select('path, name, metadata, sort_order')
    .eq('kind', 'sport').eq('depth', 2).eq('is_active', true).like('path', 'sports/premier-league/%').order('name');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    teams: (data ?? []).map((c: any) => ({ path: c.path, name: c.name, motto: c.metadata?.motto ?? null, default: defaultMotto(c.path) })),
  });
}

export async function PATCH(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const body = await request.json().catch(() => ({}));
  if (typeof body.path !== 'string' || !body.path.startsWith('sports/')) return NextResponse.json({ error: 'Which team?' }, { status: 400 });
  let motto: string | null = null;
  if (body.motto && String(body.motto).trim()) {
    motto = cleanSlogan(body.motto);
    if (!motto) return NextResponse.json({ error: `Up to ${SLOGAN_MAX} characters: letters, numbers, spaces and simple punctuation` }, { status: 400 });
  }
  const supabase = serviceClient();
  const { data: col } = await supabase.from('collections').select('id, metadata').eq('path', body.path).maybeSingle();
  if (!col) return NextResponse.json({ error: 'Team not found' }, { status: 404 });
  const metadata = { ...((col.metadata as any) ?? {}) };
  if (motto) metadata.motto = motto; else delete metadata.motto;
  const { error } = await supabase.from('collections').update({ metadata, updated_at: new Date().toISOString() }).eq('id', col.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, motto });
}
