/**
 * Collections for customers (server only): the tree with design counts and pictures, and one
 * collection's page (breadcrumb, collections inside it, designs, breeds). Only active
 * collections; designs are public, listed catalogue designs.
 */
import { inSeason, type SeasonWindow } from './definitions';

export interface PublicCollection {
  id: string; kind: string; path: string; parentPath: string | null; depth: number;
  name: string; shortName: string | null; description: string | null;
  designs: number; heroImageId: string | null;
  seasonal: boolean; inSeason: boolean; seasons: SeasonWindow[];
  details: Record<string, unknown>;   // colours (teams), symbol/from/to (zodiac), code/cat name (Pawsonality)
  sortOrder: number;
}

const DETAIL_KEYS = ['colours', 'symbol', 'from', 'to', 'element', 'code', 'cat_name', 'dog_name', 'league'];

export async function loadPublicTree(supabase: any, today = new Date()): Promise<PublicCollection[]> {
  const [{ data: cols, error }, { data: summary, error: sErr }] = await Promise.all([
    supabase.from('collections').select('id, kind, path, depth, name, short_name, description, season_windows, metadata, sort_order').eq('is_active', true).order('depth').order('sort_order'),
    supabase.rpc('collection_summary'),
  ]);
  if (error) throw error;
  if (sErr) throw sErr;
  const s = new Map<string, any>((summary ?? []).map((r: any) => [r.collection_id, r]));
  return (cols ?? []).map((c: any) => {
    const seasons: SeasonWindow[] = Array.isArray(c.season_windows) ? c.season_windows : [];
    const details: Record<string, unknown> = {};
    for (const k of DETAIL_KEYS) if (c.metadata?.[k] !== undefined) details[k] = c.metadata[k];
    return {
      id: c.id, kind: c.kind, path: c.path, depth: c.depth,
      parentPath: c.path.includes('/') ? c.path.slice(0, c.path.lastIndexOf('/')) : null,
      name: c.name, shortName: c.short_name, description: c.description,
      designs: s.get(c.id)?.designs ?? 0, heroImageId: s.get(c.id)?.hero_image_id ?? null,
      seasonal: seasons.length > 0, inSeason: inSeason(seasons, today), seasons, details, sortOrder: c.sort_order,
    };
  });
}

/** In-season occasions with designs first (nearest end of season first), then the rest in order */
export function orderOccasions(items: PublicCollection[], today = new Date()): PublicCollection[] {
  const md = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const daysLeft = (c: PublicCollection) => {
    const w = c.seasons.find(x => (x.start <= x.end ? md >= x.start && md <= x.end : md >= x.start || md <= x.end));
    if (!w) return 999;
    const [m, d] = w.end.split('-').map(Number);
    const end = new Date(today.getFullYear(), m - 1, d);
    if (end < today) end.setFullYear(end.getFullYear() + 1);
    return Math.round((end.getTime() - today.getTime()) / 86400000);
  };
  return [...items].sort((a, b) => Number(b.inSeason) - Number(a.inSeason) || (a.inSeason ? daysLeft(a) - daysLeft(b) : 0) || a.sortOrder - b.sortOrder);
}

export function cleanPath(raw: string | null | undefined): string | null {
  const p = (raw ?? '').toLowerCase().replace(/^\/+|\/+$/g, '');
  return /^[a-z0-9]+(-[a-z0-9]+)*(\/[a-z0-9]+(-[a-z0-9]+)*){0,2}$/.test(p) ? p : null;
}

export async function loadCollectionPage(supabase: any, path: string, opts: { animal?: string | null; breedSlug?: string | null; page?: number; pageSize?: number } = {}) {
  const tree = await loadPublicTree(supabase);
  const node = tree.find(c => c.path === path);
  if (!node) return null;
  const pageSize = opts.pageSize ?? 24;
  const page = Math.max(0, opts.page ?? 0);

  const { data: breeds } = await supabase.rpc('collection_breeds', { p_path: path });
  const breed = opts.breedSlug ? (breeds ?? []).find((b: any) => b.slug === opts.breedSlug) ?? null : null;
  const animal = opts.animal === 'dog' || opts.animal === 'cat' ? opts.animal : null;
  const { data: hits, error } = await supabase.rpc('collection_designs', {
    p_path: path, p_animal: breed ? null : animal, p_breed_id: breed?.breed_id ?? null, p_limit: pageSize, p_offset: page * pageSize,
  });
  if (error) throw error;
  const ids = (hits ?? []).map((h: any) => h.id);
  const { data: rows } = ids.length
    ? await supabase.from('image_catalog')
      .select('id, description, public_url, format_id, breeds!breed_id (name, slug, animal_type)')
      .in('id', ids)
    : { data: [] };
  const byId = new Map((rows ?? []).map((r: any) => [r.id, r]));

  const crumbs: { name: string; path: string }[] = [];
  for (let p: string | null = node.parentPath; p; p = tree.find(c => c.path === p)?.parentPath ?? null) {
    const n = tree.find(c => c.path === p);
    if (n) crumbs.unshift({ name: n.name, path: n.path });
  }
  let children = tree.filter(c => c.parentPath === path && c.designs > 0);
  if (node.kind === 'occasion' && node.depth === 0) children = orderOccasions(children);
  const parent = node.parentPath ? tree.find(c => c.path === node.parentPath) : null;
  const siblings = parent ? tree.filter(c => c.parentPath === parent.path && c.designs > 0 && c.path !== path) : [];

  return {
    collection: node,
    breadcrumb: crumbs,
    children,
    siblings: siblings.slice(0, 12),
    breeds: (breeds ?? []).map((b: any) => ({ name: b.name, slug: b.slug, animalType: b.animal_type, designs: b.designs })),
    filter: { animal: breed ? breed.animal_type : animal, breed: breed ? { name: breed.name, slug: breed.slug } : null },
    designs: ids.map((id: string) => byId.get(id)).filter(Boolean).map((r: any) => ({
      id: r.id, description: r.description, publicUrl: r.public_url, formatId: r.format_id,
      breed: r.breeds ? { name: r.breeds.name, slug: r.breeds.slug, animalType: r.breeds.animal_type } : null,
    })),
    total: Number(hits?.[0]?.total ?? 0), page, pageSize,
  };
}
