/** Offers: what the Admin > Offers page shows and does (server only). The routes under app/api/admin/offers/ are thin wrappers. */
import type { SupabaseClient } from '@supabase/supabase-js';
import { cloudinaryService } from '@/lib/cloudinary';
import { maskEmail } from '@/lib/marketing/preferences';
import { designTitle } from '@/lib/marketing/audiences';
import { loadPaidOrderTimes } from './data';
import { offersDayUsage, offersTablesExist } from './run';
import { MIGRATION_FILE, loadOfferSettings, type OfferSettings } from './settings';

export const STATUSES = ['queued', 'generating', 'ready', 'approved', 'sent', 'skipped', 'failed'] as const;
export { parseDesignIds } from './parse';

export interface OfferCard {
  id: string; round: string; status: string; masked: string; petName: string | null; breed: string | null;
  photoUrl: string | null; firstDesign: string | null;
  pictures: { id: string; url: string; title: string; reason: string }[];
  error: string | null; dueAt: string; generatedAt: string | null; sentAt: string | null; clickedAt: string | null; bought: boolean;
  campaign: string | null;
}

export interface OffersState {
  migration: boolean;
  migrationFile: string;
  settings: OfferSettings;
  counts: Record<string, number>;
  dayUsed: number;
  offers: OfferCard[];
  campaigns: CampaignCard[];
  collections: { path: string; name: string }[];
}
export interface CampaignCard { id: string; name: string; subject: string | null; intro: string | null; status: string; collectionPath: string | null; designs: { id: string; title: string }[]; counts: Record<string, number>; createdAt: string; startedAt: string | null }

const chunks = <T,>(xs: T[], n = 150): T[][] => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));

async function byIds(supabase: SupabaseClient, table: string, cols: string, ids: string[]) {
  const out = new Map<string, any>();
  for (const c of chunks(Array.from(new Set(ids.filter(Boolean))))) {
    const { data } = await supabase.from(table).select(cols).in('id', c);
    for (const r of (data ?? []) as any[]) out.set(r.id, r);
  }
  return out;
}

export async function loadOffersState(supabase: SupabaseClient, now = Date.now()): Promise<OffersState> {
  const settings = await loadOfferSettings();
  const base = { migrationFile: MIGRATION_FILE, settings, counts: {}, dayUsed: 0, offers: [] as OfferCard[], campaigns: [] as CampaignCard[], collections: [] as { path: string; name: string }[] };
  if (!(await offersTablesExist(supabase))) return { migration: false, ...base };

  const { data: rows, error } = await supabase.from('preview_offers').select('*').order('created_at', { ascending: false }).limit(600);
  if (error) throw new Error(error.message);
  const offers = (rows ?? []) as any[];
  const counts: Record<string, number> = Object.fromEntries(STATUSES.map(s => [s, 0]));
  for (const o of offers) counts[o.status] = (counts[o.status] ?? 0) + 1;

  const imageIds = offers.flatMap(o => [o.source_custom_image_id, ...(o.custom_image_ids ?? [])]);
  const [images, paid] = await Promise.all([
    byIds(supabase, 'customer_custom_images', 'id, pet_name, pet_breed_id, pet_image_url, catalog_image_id, generated_cloudinary_id', imageIds),
    loadPaidOrderTimes(supabase),
  ]);
  const catalogIds: string[] = [];
  for (const o of offers) { const s = images.get(o.source_custom_image_id); if (s?.catalog_image_id) catalogIds.push(s.catalog_image_id); for (const d of o.designs ?? []) catalogIds.push(d.id); }
  const [catalog, breeds, campaignRows] = await Promise.all([
    byIds(supabase, 'image_catalog', 'id, description', catalogIds),
    byIds(supabase, 'breeds', 'id, name', Array.from(images.values()).map((i: any) => i.pet_breed_id)),
    supabase.from('offer_campaigns').select('*').order('created_at', { ascending: false }).limit(50),
  ]);
  const campaigns = (campaignRows.data ?? []) as any[];
  const campaignName = new Map(campaigns.map(c => [c.id, c.name as string]));

  const cards: OfferCard[] = offers.map(o => {
    const source = images.get(o.source_custom_image_id);
    const designs: any[] = o.designs ?? [];
    const pictures = (o.custom_image_ids ?? []).map((id: string) => {
      const img = images.get(id);
      const d = designs.find(x => x.customImageId === id) ?? designs.find(x => x.id === img?.catalog_image_id);
      return {
        id, reason: d?.reason ?? '',
        title: designTitle(catalog.get(img?.catalog_image_id)?.description),
        // The watermarked preview, as customers see it
        url: img?.generated_cloudinary_id ? cloudinaryService.getPublicVariantUrl(img.generated_cloudinary_id, 'catalog_watermarked', { width: 480, format: 'jpg' }) : '',
      };
    });
    const since = Date.parse(o.sent_at ?? o.created_at);
    return {
      id: o.id, round: o.round, status: o.status, masked: maskEmail(o.email), petName: source?.pet_name ?? null,
      breed: source?.pet_breed_id ? breeds.get(source.pet_breed_id)?.name ?? null : null,
      photoUrl: source?.pet_image_url ?? null, firstDesign: source?.catalog_image_id ? designTitle(catalog.get(source.catalog_image_id)?.description) : null,
      pictures, error: o.error ?? null, dueAt: o.due_at, generatedAt: o.generated_at, sentAt: o.sent_at, clickedAt: o.clicked_at,
      bought: (paid.get(o.email) ?? []).some(t => t >= since), campaign: o.campaign_id ? campaignName.get(o.campaign_id) ?? null : null,
    };
  });

  // A running campaign is done once none of its offers is still waiting for anything
  for (const c of campaigns) {
    const mine = offers.filter(o => o.campaign_id === c.id);
    if (c.status === 'running' && mine.length && !mine.some(o => ['queued', 'generating', 'ready', 'approved'].includes(o.status))) {
      c.status = 'done';
      await supabase.from('offer_campaigns').update({ status: 'done' }).eq('id', c.id).eq('status', 'running');
    }
  }

  const designIds = campaigns.flatMap(c => c.design_ids ?? []);
  const designs = await byIds(supabase, 'image_catalog', 'id, description', designIds);
  const campaignCards: CampaignCard[] = campaigns.map(c => ({
    id: c.id, name: c.name, subject: c.subject, intro: c.intro, status: c.status, collectionPath: c.collection_path,
    designs: (c.design_ids ?? []).map((id: string) => ({ id, title: designTitle(designs.get(id)?.description) })),
    counts: offers.filter(o => o.campaign_id === c.id).reduce((m: Record<string, number>, o) => ({ ...m, [o.status]: (m[o.status] ?? 0) + 1 }), {}),
    createdAt: c.created_at, startedAt: c.started_at,
  }));

  const { data: cols } = await supabase.from('collections').select('path, name, kind, depth').eq('is_active', true).eq('kind', 'occasion').order('path');
  return {
    migration: true, migrationFile: MIGRATION_FILE, settings, counts, dayUsed: await offersDayUsage(supabase, now), offers: cards, campaigns: campaignCards,
    collections: ((cols ?? []) as any[]).map(c => ({ path: c.path, name: c.name })),
  };
}
