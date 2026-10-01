/**
 * GET /api/public/themes-with-designs
 * Themes that have at least one public catalogue design, most designs first, each with
 * one design id for a thumbnail. Themes with no designs are left out (they'd be empty pages).
 */
import { NextResponse } from 'next/server';
import { serviceClient } from '@/lib/qr/server';

export const revalidate = 300;

export async function GET() {
  const supabase = serviceClient();

  const { data: images, error } = await supabase
    .from('image_catalog')
    .select('id, theme_id, rating, is_featured')
    .eq('is_public', true)
    .not('theme_id', 'is', null)
    .or('is_customer_generated.is.null,is_customer_generated.eq.false')
    .order('created_at', { ascending: false })
    .limit(2000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const byTheme = new Map<string, { count: number; imageId: string; score: number }>();
  for (const img of images ?? []) {
    const score = (img.is_featured ? 10 : 0) + (img.rating || 0);
    const cur = byTheme.get(img.theme_id);
    if (!cur) byTheme.set(img.theme_id, { count: 1, imageId: img.id, score });
    else { cur.count += 1; if (score > cur.score) { cur.imageId = img.id; cur.score = score; } }
  }
  if (!byTheme.size) return NextResponse.json({ themes: [] });

  const { data: themes, error: tErr } = await supabase
    .from('themes').select('id, name, is_active').in('id', Array.from(byTheme.keys()));
  if (tErr) return NextResponse.json({ error: tErr.message }, { status: 500 });

  const out = (themes ?? [])
    .filter(t => t.is_active !== false)
    .map(t => ({ id: t.id, name: t.name, count: byTheme.get(t.id)!.count, imageId: byTheme.get(t.id)!.imageId }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  return NextResponse.json({ themes: out });
}
