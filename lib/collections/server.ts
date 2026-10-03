/**
 * Collections (server only): the admin tree with design counts and season state, input checks,
 * and theme → collection filing. Customer-facing reads come in phase 3.
 */
import { inSeason, suggestCollectionForTheme, type SeasonWindow } from './definitions';

export const KINDS = ['occasion', 'sport', 'pawsonality', 'zodiac'] as const;

export function slugify(s: string): string {
  return s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}

const MD = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
/** Checks season windows from the admin form; returns the cleaned list or an error message */
export function cleanWindows(raw: unknown): { windows: SeasonWindow[] } | { error: string } {
  if (!Array.isArray(raw)) return { error: 'Seasons must be a list' };
  if (raw.length > 4) return { error: 'At most 4 season windows' };
  const windows: SeasonWindow[] = [];
  for (const w of raw) {
    const start = String((w as any)?.start ?? '').trim(), end = String((w as any)?.end ?? '').trim();
    if (!MD.test(start) || !MD.test(end)) return { error: `Dates must look like 11-01 (month-day): got "${start}" to "${end}"` };
    windows.push({ start, end });
  }
  return { windows };
}

export function cleanTerms(raw: unknown): string[] {
  const list = Array.isArray(raw) ? raw : String(raw ?? '').split(',');
  return Array.from(new Set(list.map(t => String(t).toLowerCase().trim()).filter(t => t && t.length <= 40))).slice(0, 30);
}

export interface AdminCollection {
  id: string; kind: string; parent_id: string | null; slug: string; path: string; depth: number;
  name: string; short_name: string | null; description: string | null; season_windows: SeasonWindow[];
  hero_image_id: string | null; outfit_id: string | null; metadata: any; search_terms: string[];
  sort_order: number; is_active: boolean; designs: number; in_season: boolean | null;
}

export async function adminTree(supabase: any, today = new Date()) {
  const [{ data: cols, error }, { data: counts }, { data: themes }, { data: designs }] = await Promise.all([
    supabase.from('collections').select('id, kind, parent_id, slug, path, depth, name, short_name, description, season_windows, hero_image_id, outfit_id, metadata, search_terms, sort_order, is_active').order('depth').order('sort_order'),
    supabase.from('collection_design_counts').select('collection_id, designs'),
    supabase.from('themes').select('id, name, slug, is_active, default_collection_id').order('sort_order').order('name'),
    supabase.from('image_catalog').select('theme_id').not('theme_id', 'is', null).limit(100000),
  ]);
  if (error) throw error;
  const countBy = new Map<string, number>((counts ?? []).map((c: any) => [c.collection_id, c.designs]));
  const collections: AdminCollection[] = (cols ?? []).map((c: any) => ({
    ...c,
    designs: countBy.get(c.id) ?? 0,
    in_season: c.season_windows?.length ? inSeason(c.season_windows, today) : null,
  }));
  const byPath = new Map(collections.map(c => [c.path, c.id]));
  const themeDesigns = new Map<string, number>();
  for (const d of designs ?? []) themeDesigns.set(d.theme_id, (themeDesigns.get(d.theme_id) ?? 0) + 1);
  return {
    collections,
    themes: (themes ?? []).map((t: any) => {
      const sp = suggestCollectionForTheme(t.name);
      return { ...t, designs: themeDesigns.get(t.id) ?? 0, suggested_collection_id: sp ? byPath.get(sp) ?? null : null };
    }),
  };
}
