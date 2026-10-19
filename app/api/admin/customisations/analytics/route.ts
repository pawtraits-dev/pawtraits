import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, serviceClient } from '@/lib/qr/server';
import { add, breedSource, emptyBucket, finish, loadCustomisations, loadOutcomes, type Bucket } from '@/lib/admin/customisation-stats';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * GET /api/admin/customisations/analytics?days=30   (days=0: all time)
 * Customisations made in the period, with totals, a daily series and tables by design, by the
 * pet's breed and by where the visitor came from. Purchases and shares count whenever they
 * happened (a customisation made in the period and bought later still counts as bought).
 */
export async function GET(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const days = Math.max(0, Math.min(Number(new URL(request.url).searchParams.get('days') ?? 30) || 0, 3650));
  const since = days ? new Date(Date.now() - days * 86_400_000).toISOString() : null;
  const supabase = serviceClient();

  try {
    const rows = await loadCustomisations(supabase, since);
    const outcomes = await loadOutcomes(supabase, rows);

    // Main currency: the one most revenue lines are in (others are listed separately)
    const byCurrency: Record<string, number> = {};
    outcomes.forEach(o => { for (const [c, v] of Object.entries(o.revenue)) byCurrency[c] = (byCurrency[c] ?? 0) + v; });
    const currency = Object.keys(byCurrency).sort((a, b) => byCurrency[b] - byCurrency[a])[0] ?? 'GBP';

    const total = emptyBucket();
    const daily = new Map<string, { customisations: number; purchased: number; shared: number }>();
    const designs = new Map<string, Bucket>();
    const breeds = new Map<string, Bucket>();
    const sources = new Map<string, Bucket>();
    const coverage = { profile: 0, detected: 0, unmatched: 0, unknown: 0 };
    const unmatchedNames = new Map<string, number>();

    for (const r of rows) {
      const o = outcomes.get(r.id);
      add(total, r, o, currency);
      const day = r.created_at.slice(0, 10);
      const d = daily.get(day) ?? { customisations: 0, purchased: 0, shared: 0 };
      d.customisations += 1;
      if (o?.purchased) d.purchased += 1;
      if (o && (o.shares > 0 || o.views > 0)) d.shared += 1;
      daily.set(day, d);

      const designKey = r.catalog_image_id ?? 'none';
      if (!designs.has(designKey)) designs.set(designKey, emptyBucket());
      add(designs.get(designKey)!, r, o, currency);

      const src = breedSource(r);
      coverage[src] += 1;
      const breedKey = r.pet_breed_id ?? (src === 'unmatched' ? 'unmatched' : 'unknown');
      if (src === 'unmatched') {
        const n = String(r.metadata?.detected_breed?.name || 'Other');
        unmatchedNames.set(n, (unmatchedNames.get(n) ?? 0) + 1);
      }
      if (!breeds.has(breedKey)) breeds.set(breedKey, emptyBucket());
      add(breeds.get(breedKey)!, r, o, currency);

      const source = String(r.metadata?.source || 'unknown');
      if (!sources.has(source)) sources.set(source, emptyBucket());
      add(sources.get(source)!, r, o, currency);
    }

    // Names and pictures for the designs and breeds
    const designIds = Array.from(designs.keys()).filter(k => k !== 'none');
    const breedIds = Array.from(breeds.keys()).filter(k => k !== 'unknown' && k !== 'unmatched');
    const designInfo = new Map<string, any>();
    for (let i = 0; i < designIds.length; i += 200) {
      const { data } = await supabase.from('image_catalog')
        .select('id, description, cloudinary_public_id, public_url, breeds:breed_id (name), themes:theme_id (name)')
        .in('id', designIds.slice(i, i + 200));
      for (const d of data ?? []) designInfo.set(d.id, d);
    }
    const breedInfo = new Map<string, any>();
    if (breedIds.length) {
      const { data } = await supabase.from('breeds').select('id, name, animal_type').in('id', breedIds);
      for (const b of data ?? []) breedInfo.set(b.id, b);
    }
    const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME;
    const thumb = (d: any) => (d?.cloudinary_public_id && cloud ? `https://res.cloudinary.com/${cloud}/image/upload/c_fill,g_auto,w_96,h_120,f_auto,q_auto/${d.cloudinary_public_id}` : d?.public_url ?? null);
    const titleOf = (desc?: string | null) => (desc || '').match(/\*\*(.+?)\*\*/)?.[1]?.trim() || (desc || '').replace(/[*#_]/g, '').slice(0, 60) || 'Untitled design';
    const one = (v: any) => (Array.isArray(v) ? v[0] : v);

    // Daily series with empty days filled in
    const series: { date: string; customisations: number; purchased: number; shared: number }[] = [];
    const first = since ? new Date(since) : rows.length ? new Date(rows[rows.length - 1].created_at) : new Date();
    for (let t = Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), first.getUTCDate()); t <= Date.now(); t += 86_400_000) {
      const date = new Date(t).toISOString().slice(0, 10);
      series.push({ date, ...(daily.get(date) ?? { customisations: 0, purchased: 0, shared: 0 }) });
    }

    return NextResponse.json({
      days, since, currency,
      otherRevenue: Object.fromEntries(Object.entries(byCurrency).filter(([c]) => c !== currency)),
      totals: finish(total),
      daily: series,
      breedCoverage: coverage,
      unmatchedBreeds: Array.from(unmatchedNames.entries()).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([name, count]) => ({ name, count })),
      designs: Array.from(designs.entries()).map(([id, b]) => {
        const d = designInfo.get(id);
        return { id, title: id === 'none' ? 'No design' : titleOf(d?.description), thumb: thumb(d), designBreed: one(d?.breeds)?.name ?? null, theme: one(d?.themes)?.name ?? null, ...finish(b) };
      }),
      breeds: Array.from(breeds.entries()).map(([id, b]) => {
        const info = breedInfo.get(id);
        const name = id === 'unknown' ? 'Not known' : id === 'unmatched' ? 'Other / mixed (detected)' : info?.name ?? 'Unknown breed';
        return { id, name, animal: info?.animal_type ?? null, ...finish(b) };
      }),
      sources: Array.from(sources.entries()).map(([id, b]) => ({ id, name: id, ...finish(b) })),
    });
  } catch (e: any) {
    console.error('customisation analytics failed', e);
    return NextResponse.json({ error: e?.message || 'Analytics failed' }, { status: 500 });
  }
}
