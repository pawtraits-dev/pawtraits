import { NextResponse } from 'next/server';
import { requireAdmin, serviceClient } from '@/lib/qr/server';
import { titleFromDescription, titleIssues, findDuplicateTitles, cleanTitle } from '@/lib/catalogue/title-hygiene';

export const dynamic = 'force-dynamic';

const PAGE = 1000;

/** Admin report: catalogue titles (the first line of image_catalog.description) with markdown, a different breed's name, or duplicates */
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const supabase = serviceClient();

    const rows: { id: string; description: string | null; is_public: boolean | null; breeds: any }[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from('image_catalog')
        .select('id, description, is_public, breeds(name)')
        .order('created_at', { ascending: false })
        .order('id')
        .range(from, from + PAGE - 1);
      if (error) throw error;
      rows.push(...((data ?? []) as any[]));
      if (!data || data.length < PAGE) break;
    }

    const breedNames: string[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase.from('breeds').select('name').order('name').range(from, from + PAGE - 1);
      if (error) throw error;
      breedNames.push(...((data ?? []) as any[]).map(b => b.name).filter(Boolean));
      if (!data || data.length < PAGE) break;
    }

    const items = rows.map(r => ({
      id: r.id,
      title: titleFromDescription(r.description),
      breedName: (Array.isArray(r.breeds) ? r.breeds[0]?.name : r.breeds?.name) ?? null,
      isPublic: r.is_public !== false,
    }));

    const issues = items
      .map(i => ({ id: i.id, title: i.title, breedName: i.breedName, problems: titleIssues({ title: i.title, breedName: i.breedName, allBreedNames: breedNames }) }))
      .filter(i => i.problems.length > 0);

    // Duplicates only matter among designs customers can see
    const dupes = findDuplicateTitles(items.filter(i => i.isPublic).map(i => ({ id: i.id, title: i.title })));
    const byId = new Map(items.map(i => [i.id, i]));
    const duplicates = Array.from(dupes.entries()).map(([, ids]) => ({ title: cleanTitle(byId.get(ids[0])?.title ?? ''), ids }));

    return NextResponse.json({ total: items.length, issues, duplicates });
  } catch (e: any) {
    console.error('catalogue-checks failed', e);
    return NextResponse.json({ error: e?.message || 'Could not run the checks' }, { status: 500 });
  }
}
