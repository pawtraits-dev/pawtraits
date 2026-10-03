/** POST /api/admin/collections/themes/apply-all — re-file every mapped theme's designs */
import { NextResponse } from 'next/server';
import { requireAdmin, serviceClient } from '@/lib/qr/server';

export const dynamic = 'force-dynamic';

export async function POST() {
  const denied = await requireAdmin();
  if (denied) return denied;
  const supabase = serviceClient();
  try {
    const { data: themes, error } = await supabase.from('themes').select('id');
    if (error) throw error;
    let added = 0;
    for (const t of themes ?? []) {
      const { data, error: e } = await supabase.rpc('apply_theme_collection', { p_theme_id: t.id });
      if (e) throw e;
      added += data ?? 0;
    }
    return NextResponse.json({ ok: true, added });
  } catch (e) {
    console.error('apply-all failed', e);
    return NextResponse.json({ error: 'Could not re-file designs' }, { status: 500 });
  }
}
