/** Offers: what the Admin > Offers page shows and does (server only). The routes under app/api/admin/offers/ are thin wrappers. */
import type { SupabaseClient } from '@supabase/supabase-js';
import { cloudinaryService } from '@/lib/cloudinary';
import { maskEmail } from '@/lib/marketing/preferences';
import { designTitle } from '@/lib/marketing/audiences';
import { loadCampaignPeople, loadPaidOrderTimes } from './data';
import { birthdayWindow, dueWithin, offerLabel, roundKind, signOfRound, zodiacWindow } from './dates';
import { buildAudience } from './eligibility';
import { BIRTHDAY_COLLECTION } from './generate';
import { campaignDesignIds, loadDesigns, suitableCount } from './select-designs';
import { campaignsMigrationReady, ensureAutomaticCampaigns, offersDayUsage, offersTablesExist, type AutomaticCampaign } from './run';
import { CAMPAIGNS_MIGRATION_FILE, MIGRATION_FILE, loadOfferSettings, type OfferSettings } from './settings';

export const STATUSES = ['queued', 'generating', 'ready', 'approved', 'sent', 'skipped', 'failed'] as const;
export { parseDesignIds } from './parse';

export interface OfferCard {
  id: string; round: string; status: string; masked: string; petName: string | null; breed: string | null;
  photoUrl: string | null; firstDesign: string | null;
  pictures: { id: string; url: string; title: string; reason: string }[];
  error: string | null; dueAt: string; generatedAt: string | null; sentAt: string | null; clickedAt: string | null; bought: boolean;
  campaign: string | null;
  /** 'Previewer' or 'Buyer' */
  audience: 'previewer' | 'buyer';
  /** what this offer is: Round 1, Round 2, Birthday, Zodiac: Leo, or the campaign's name */
  label: string;
  /** buyers: when and where they were shown the photo wording */
  shown: { at: string; source: string } | null;
  /** birthday / zodiac: the day it is for */
  eventDate: string | null;
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
  /** the second migration (buyers, birthdays, automatic campaigns) is in place */
  campaignsMigration: boolean;
  campaignsMigrationFile: string;
  automatic: AutomaticCard[];
}
export interface AutomaticCard extends AutomaticCampaign { name: string; daysBefore: number; counts: Record<string, number> }
export interface AutomaticStats { total: number; known: number; due30: number; designs: number | null; problem: string | null }
export interface CampaignCard { id: string; kind: string; audience: string; name: string; subject: string | null; intro: string | null; status: string; collectionPath: string | null; designs: { id: string; title: string }[]; counts: Record<string, number>; createdAt: string; startedAt: string | null }

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
  const base = { migrationFile: MIGRATION_FILE, campaignsMigration: false, campaignsMigrationFile: CAMPAIGNS_MIGRATION_FILE, automatic: [] as AutomaticCard[], settings, counts: {}, dayUsed: 0, offers: [] as OfferCard[], campaigns: [] as CampaignCard[], collections: [] as { path: string; name: string }[] };
  if (!(await offersTablesExist(supabase))) return { migration: false, ...base };

  const { data: rows, error } = await supabase.from('preview_offers').select('*').order('created_at', { ascending: false }).limit(600);
  if (error) throw new Error(error.message);
  const offers = (rows ?? []) as any[];
  const counts: Record<string, number> = Object.fromEntries(STATUSES.map(s => [s, 0]));
  for (const o of offers) counts[o.status] = (counts[o.status] ?? 0) + 1;

  const imageIds = offers.flatMap(o => [o.source_custom_image_id, ...(o.custom_image_ids ?? [])]);
  const [images, paid, pets, prefs] = await Promise.all([
    byIds(supabase, 'customer_custom_images', 'id, pet_name, pet_breed_id, pet_image_url, catalog_image_id, generated_cloudinary_id', imageIds),
    loadPaidOrderTimes(supabase),
    byIds(supabase, 'pets', 'id, name, breed_id, primary_photo_url', offers.map(o => o.source_pet_id)),
    supabase.from('email_preferences').select('email, photo_words_shown_at, photo_words_source').in('email', Array.from(new Set(offers.filter(o => o.audience === 'buyer').map(o => String(o.email))))),
  ]);
  const shownBy = new Map<string, { at: string; source: string }>();
  for (const r of ((prefs.data ?? []) as any[])) if (r.photo_words_shown_at) shownBy.set(r.email, { at: r.photo_words_shown_at, source: r.photo_words_source ?? '' });
  const catalogIds: string[] = [];
  for (const o of offers) { const s = images.get(o.source_custom_image_id); if (s?.catalog_image_id) catalogIds.push(s.catalog_image_id); for (const d of o.designs ?? []) catalogIds.push(d.id); }
  const [catalog, breeds, campaignRows] = await Promise.all([
    byIds(supabase, 'image_catalog', 'id, description', catalogIds),
    byIds(supabase, 'breeds', 'id, name', [...Array.from(images.values()).map((i: any) => i.pet_breed_id), ...Array.from(pets.values()).map((p: any) => p.breed_id)]),
    supabase.from('offer_campaigns').select('*').order('created_at', { ascending: false }).limit(50),
  ]);
  const campaigns = (campaignRows.data ?? []) as any[];
  const campaignName = new Map(campaigns.map(c => [c.id, c.name as string]));

  const cards: OfferCard[] = offers.map(o => {
    const source = images.get(o.source_custom_image_id);
    const pet = o.source_pet_id ? pets.get(o.source_pet_id) : null;
    const firstMade = images.get((o.custom_image_ids ?? [])[0]);
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
      id: o.id, round: o.round, status: o.status, masked: maskEmail(o.email), petName: source?.pet_name ?? pet?.name ?? firstMade?.pet_name ?? null,
      breed: source?.pet_breed_id ? breeds.get(source.pet_breed_id)?.name ?? null : pet?.breed_id ? breeds.get(pet.breed_id)?.name ?? null : null,
      photoUrl: source?.pet_image_url ?? pet?.primary_photo_url ?? null, firstDesign: source?.catalog_image_id ? designTitle(catalog.get(source.catalog_image_id)?.description) : null,
      pictures, error: o.error ?? null, dueAt: o.due_at, generatedAt: o.generated_at, sentAt: o.sent_at, clickedAt: o.clicked_at,
      bought: (paid.get(o.email) ?? []).some(t => t >= since), campaign: o.campaign_id ? campaignName.get(o.campaign_id) ?? null : null,
      audience: o.audience === 'buyer' ? 'buyer' : 'previewer', eventDate: o.event_date ?? null,
      label: offerLabel(o.round, o.campaign_id ? campaignName.get(o.campaign_id) ?? null : null),
      shown: o.audience === 'buyer' ? shownBy.get(o.email) ?? null : null,
    };
  });

  // A running campaign is done once none of its offers is still waiting for anything
  for (const c of campaigns.filter(c => (c.kind ?? 'manual') === 'manual')) {
    const mine = offers.filter(o => o.campaign_id === c.id);
    if (c.status === 'running' && mine.length && !mine.some(o => ['queued', 'generating', 'ready', 'approved'].includes(o.status))) {
      c.status = 'done';
      await supabase.from('offer_campaigns').update({ status: 'done' }).eq('id', c.id).eq('status', 'running');
    }
  }

  const designIds = campaigns.flatMap(c => c.design_ids ?? []);
  const designs = await byIds(supabase, 'image_catalog', 'id, description', designIds);
  const campaignCards: CampaignCard[] = campaigns.filter(c => (c.kind ?? 'manual') === 'manual').map(c => ({
    id: c.id, kind: c.kind ?? 'manual', audience: c.audience ?? 'previewers', name: c.name, subject: c.subject, intro: c.intro, status: c.status, collectionPath: c.collection_path,
    designs: (c.design_ids ?? []).map((id: string) => ({ id, title: designTitle(designs.get(id)?.description) })),
    counts: offers.filter(o => o.campaign_id === c.id).reduce((m: Record<string, number>, o) => ({ ...m, [o.status]: (m[o.status] ?? 0) + 1 }), {}),
    createdAt: c.created_at, startedAt: c.started_at,
  }));

  const { data: cols } = await supabase.from('collections').select('path, name, kind, depth').eq('is_active', true).eq('kind', 'occasion').order('path');
  const ready = await campaignsMigrationReady(supabase);
  const automatic: AutomaticCard[] = ready ? (await ensureAutomaticCampaigns(supabase)).map(c => ({
    ...c, name: c.kind === 'birthday' ? 'Birthday' : 'Zodiac', daysBefore: c.kind === 'birthday' ? settings.birthdayDaysBefore : settings.zodiacDaysBefore,
    counts: offers.filter(o => o.campaign_id === c.id).reduce((m: Record<string, number>, o) => ({ ...m, [o.status]: (m[o.status] ?? 0) + 1 }), {}),
  })) : [];
  return {
    migration: true, migrationFile: MIGRATION_FILE, campaignsMigration: ready, campaignsMigrationFile: CAMPAIGNS_MIGRATION_FILE, automatic, settings, counts, dayUsed: await offersDayUsage(supabase, now), offers: cards, campaigns: campaignCards,
    collections: ((cols ?? []) as any[]).map(c => ({ path: c.path, name: c.name })),
  };
}


export { offerLabel };

/**
 * How much we know, for the Automatic campaigns cards (computed on request: it reads every person): among the people a campaign could reach, how many have
 * a known birthday / sign, and how many are due in the next 30 days. `designs` is how many designs there are to paint into (birthday).
 */
export async function loadAutomaticStats(supabase: SupabaseClient, now = Date.now()): Promise<{ birthday: AutomaticStats; zodiac: AutomaticStats }> {
  const settings = await loadOfferSettings();
  const people = await loadCampaignPeople(supabase);
  const byEmail = new Map(people.map(p => [p.email, p] as const));
  const audience = buildAudience(people, now, { graceDays: settings.noticeGraceDays, audience: 'both' });
  const s = { birthdayDays: settings.birthdayDaysBefore, zodiacDays: settings.zodiacDaysBefore };
  let birthdayKnown = 0, signKnown = 0, birthdayDue = 0, zodiacDue = 0;
  for (const a of audience) {
    const has = (round: string) => byEmail.get(a.email)!.offers.some(o => o.round === round);
    if (a.birthday) birthdayKnown++;
    if (a.sign) signKnown++;
    const due = dueWithin(a, now, s, 30);
    if (due.birthday && a.birthday && !has(birthdayWindow(a.birthday, now, s.birthdayDays).round)) birthdayDue++;
    if (due.zodiac && a.sign && a.animal && !has(zodiacWindow(a.sign, now, s.zodiacDays)!.round)) zodiacDue++;
  }
  const ids = await campaignDesignIds(supabase, { design_ids: [], collection_path: BIRTHDAY_COLLECTION });
  const designs = suitableCount(await loadDesigns(supabase, ids), ids, null);
  return {
    birthday: { total: audience.length, known: birthdayKnown, due30: birthdayDue, designs, problem: designs < 2 ? 'No birthday designs to paint into' : null },
    zodiac: { total: audience.length, known: signKnown, due30: zodiacDue, designs: null, problem: null },
  };
}
