/**
 * Offers: paint a person's kept photo into the chosen designs (server only).
 *
 * For each chosen design a new customer_custom_images row is made that REUSES the stored pet photo (no re-upload), owned like the
 * source preview (guest session, address, pet name, breed and coat) so the person can open it, with metadata.offer = { offerId, round }.
 * Then the SAME pipeline the customise page uses runs (lib/customise/generate-job.ts: generateCustomImage). Differences, on purpose:
 *   - no free-preview slot and no credit is used (the customise route's daily count leaves offer pictures out)
 *   - no Meta CustomizeProduct event (metaClient: null) and no social capture
 *   - Gemini usage is recorded as feature 'offer-preview' (Admin > AI costs shows it separately)
 * If one of the pictures fails the others are kept; an offer needs at least 2 good pictures to be 'ready'.
 *
 * Whose photo: a previewer's source preview, or (buyers) the photo found by lib/offers/photo.ts: a customisation's stored pet photo, or a saved
 * pet's primary photo (lib/offers/source.ts). A stored photo is fetched from where it is; nothing is uploaded again. New pictures are owned by the
 * offer's address (and the customer's id when there is an account) so the link in the email opens them.
 *
 * Which designs: round 1/2 and hand-started campaigns as before; 'birthday:<year>' draws 3 from the birthday collection (occasions/birthday);
 * 'zodiac:<sign>:<year>' puts that sign's framed card first (drawn WITH its frame, sign symbol and the pet's name on the plate, as the customise
 * page does when the frame is left on) and 2 standard best sellers. The framed card is the only framed design an offer may contain.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { designOptions, generateCustomImage, lookupDesign, prepareDesign } from '@/lib/customise/generate-job';
import { cleanPetName } from '@/lib/picture-words';
import { FRAME_MAX } from '@/lib/frames/frame';
import { offerStillAllowed, type OfferRow } from './allowed';
import { eventPassed, signOfRound, roundKind } from './dates';
import { hasEnoughPictures } from './eligibility';
import { loadOfferSource, type OfferSource } from './source';
import { campaignDesignIds, loadDataset, pickOfferDesigns, MIN_BIRTHDAY_DESIGNS, type Animal, type Dataset, type Pick } from './select-designs';
import { OFFER_PICTURES } from './settings';

/** The collection the birthday campaign draws from (lib/collections/definitions.ts: the occasions collection's 'birthday' sub-collection) */
export const BIRTHDAY_COLLECTION = 'occasions/birthday';
export const zodiacCollection = (sign: string) => `zodiac/${sign}`;

export interface PaintResult { designId: string; imageId?: string; error?: string }

/** What the choice needs to know about this person */
async function personContext(supabase: SupabaseClient, offer: OfferRow, source: OfferSource) {
  const seen = new Set<string>();
  if (source.catalog_image_id) seen.add(source.catalog_image_id);
  const add = (rows: any[] | null) => (rows ?? []).forEach(r => r.catalog_image_id && seen.add(r.catalog_image_id));
  if (source.guest_session_id) add((await supabase.from('customer_custom_images').select('catalog_image_id').eq('guest_session_id', source.guest_session_id).limit(500)).data);
  add((await supabase.from('customer_custom_images').select('catalog_image_id').eq('customer_email', offer.email).limit(500)).data);
  const { data: reqs } = await supabase.from('preview_email_requests').select('custom_image_id').eq('email', offer.email);
  const reqImages = ((reqs ?? []) as any[]).map(r => r.custom_image_id);
  if (reqImages.length) add((await supabase.from('customer_custom_images').select('catalog_image_id').in('id', reqImages)).data);
  const { data: offers } = await supabase.from('preview_offers').select('designs').eq('email', offer.email);
  for (const o of (offers ?? []) as any[]) for (const d of o.designs ?? []) if (d?.id) seen.add(d.id);
  for (const d of offer.designs ?? []) if (d?.id) seen.add(d.id);

  let breedName: string | null = null, animal: Animal | null = null;
  if (source.pet_breed_id) {
    const { data: b } = await supabase.from('breeds').select('name, animal_type').eq('id', source.pet_breed_id).maybeSingle();
    breedName = (b as any)?.name ?? null;
    const a = (b as any)?.animal_type;
    if (a === 'dog' || a === 'cat') animal = a;
  }
  const detected = source.metadata?.detected_breed?.animal;
  if (detected === 'dog' || detected === 'cat') animal = detected;
  if (!animal && source.animal_type) animal = source.animal_type;   // a saved pet knows its animal
  return { exclude: Array.from(seen), breedName, animal };
}

/** What a zodiac card needs to be drawn: the pet's name for the plate and their animal (so nothing is detected by AI) */
interface CardOptions { animal: Animal }

const customerIdForEmail = async (supabase: SupabaseClient, email: string): Promise<string | null> =>
  (((await supabase.from('customers').select('id').ilike('email', email.replace(/[\\%_]/g, c => `\\${c}`)).limit(1).maybeSingle()).data as any)?.id as string | undefined) ?? null;

/** Make one picture: a new row from the kept photo, then the customise pipeline. `card`: this design is the sign's framed zodiac card. */
async function paintOne(supabase: SupabaseClient, offer: OfferRow, source: OfferSource, designId: string, card: CardOptions | null = null): Promise<PaintResult> {
  try {
    const { data: catalogImage, error } = await lookupDesign(supabase, designId);
    if (error || !catalogImage) return { designId, error: 'Design not found' };
    const prepared = await prepareDesign(supabase, catalogImage, designId);
    if (!prepared.catalogImageUrl || !prepared.designRef) return { designId, error: 'The design has no picture to paint from' };

    // The frame: ONLY for the zodiac card, exactly as the customise page does with the frame left on and the pet's name filled in
    // (frame=on, frameName = the pet's name, at most FRAME_MAX.pet letters). Every other design is painted as a plain portrait (frameOff).
    const frameName = card ? ((cleanPetName(source.pet_name) ?? '').slice(0, FRAME_MAX.pet).trim() || null) : null;
    const o = await designOptions(supabase, {
      catalogImage, catalogImageId: designId, designKit: prepared.designKit, designWords: prepared.designWords, petCount: 1,
      firstPet: card ? { animal_type: card.animal } : null,   // the animal is known, so the job never has to ask the AI what the pet is
      petNames: [source.pet_name], kitName: null, kitNumber: undefined, customSlogan: null, wordsName: null, captionRaw: '', frameOff: !card, frameName,
    });
    if (card && !o.frame) return { designId, error: 'That star sign design has no frame to draw' };
    const ci = catalogImage as any;
    const customerId = source.customer_id ?? (offer.audience === 'buyer' ? await customerIdForEmail(supabase, offer.email) : null);
    const { data: row, error: insertError } = await supabase.from('customer_custom_images').insert({
      customer_id: customerId,
      customer_email: offer.audience === 'buyer' ? offer.email : source.customer_email ?? offer.email,
      guest_session_id: source.guest_session_id ?? null,
      catalog_image_id: designId,
      pet_id: source.pet_id ?? null,
      pet_name: source.pet_name ?? null,
      pet_breed_id: source.pet_breed_id ?? null,
      pet_coat_id: source.pet_coat_id ?? null,
      pet_image_url: source.pet_image_url,          // the same stored photo
      pet_cloudinary_id: source.pet_cloudinary_id,
      status: 'generating',
      is_public: false,                              // offers are private to the person (the route's previews default to shareable)
      metadata: {
        catalog_theme: ci.themes?.name, catalog_style: ci.styles?.name, catalog_breed: ci.breeds?.name,
        subject_count: 1, all_pet_ids: [], all_pet_names: [source.pet_name || 'Uploaded Pet'],
        source: 'offer', offer: { offerId: offer.id, round: offer.round },
        ...(source.metadata?.detected_breed ? { detected_breed: source.metadata.detected_breed } : {}),
        ...(o.kit ? { kit: o.kit } : {}), ...(o.slogan ? { slogan: o.slogan } : {}),
        ...(o.words ? { words: { name: null, phrase: o.words.phrase } } : {}), ...(o.caption ? { caption: true } : {}), ...(o.frame ? { frame: { pet_name: frameName } } : {}),
      },
    }).select('id').single();
    if (insertError || !row) return { designId, error: `Could not create the picture: ${insertError?.message ?? 'no row'}` };
    const imageId = (row as any).id as string;

    const started = Date.now();
    try {
      await generateCustomImage({
        customImageId: imageId,
        catalogImageUrl: prepared.catalogImageUrl,
        designRef: prepared.designRef,
        petImageUrls: [source.pet_image_url],
        petUploads: [null],                          // the photo is already stored: fetched from its URL, not uploaded again
        variationPromptTemplate: prepared.variationPromptTemplate,
        themeName: ci.themes?.name || 'Custom',
        styleName: ci.styles?.name || 'Portrait',
        catalogBreedName: ci.breeds?.name || 'Pet',
        aspectRatio: ci.formats?.aspect_ratio,
        ...(source.fromPet ? { customerPetBreedName: source.breed_name ?? undefined, aiAnalysisData: source.ai_analysis_data } : {}),
        kit: o.kit, slogan: o.slogan, words: o.words, caption: o.caption, frame: o.frame,
        catalogImageId: designId,
        metaClient: null,                            // never a Meta event
        usageFeature: 'offer-preview',
        requestStarted: started,
        timings: { post: {}, request: 0 },
      });
      if (card) {
        // The job keeps the plain painting if the frame cannot be drawn: for a card that is not acceptable in the email
        const { data: done } = await supabase.from('customer_custom_images').select('generation_metadata').eq('id', imageId).maybeSingle();
        if (!(done as any)?.generation_metadata?.frame) {
          const message = 'The frame could not be drawn';
          await supabase.from('customer_custom_images').update({ status: 'failed', error_message: message }).eq('id', imageId);
          return { designId, imageId, error: message };
        }
      }
      return { designId, imageId };
    } catch (e: any) {
      const message = e instanceof Error ? e.message : 'Generation failed';
      await supabase.from('customer_custom_images').update({ status: 'failed', error_message: message }).eq('id', imageId);
      return { designId, imageId, error: message };
    }
  } catch (e: any) {
    return { designId, error: e instanceof Error ? e.message : 'Failed' };
  }
}

export type GenerateOutcome = { status: 'ready' | 'failed' | 'skipped'; error?: string; good?: number };

/** The designs for this offer: the campaign's own set, the birthday collection, or the sign's card plus best sellers */
async function chooseDesigns(supabase: SupabaseClient, offer: OfferRow, dataset: Dataset, source: OfferSource, who: Awaited<ReturnType<typeof personContext>>, count?: number): Promise<{ picks: Pick[]; card: CardOptions | null; problem?: string }> {
  const kind = roundKind(offer.round);
  const base = { supabase, dataset, petBreedId: source.pet_breed_id ?? null, petBreedName: who.breedName, petAnimal: who.animal, excludeDesignIds: who.exclude, count };
  if (kind === 'zodiac') {
    const sign = signOfRound(offer.round);
    if (!sign) return { picks: [], card: null, problem: 'Not a star sign' };
    if (!who.animal) return { picks: [], card: null, problem: 'We do not know if this pet is a dog or a cat' };
    const signDesignIds = await campaignDesignIds(supabase, { design_ids: [], collection_path: zodiacCollection(sign) });
    const picks = await pickOfferDesigns({ ...base, zodiac: { signDesignIds, animal: who.animal } });
    return { picks, card: { animal: who.animal }, problem: picks.length ? undefined : `No ${sign} card for a ${who.animal}` };
  }
  if (kind === 'birthday') {
    const picks = await pickOfferDesigns({ ...base, campaign: { design_ids: [], collection_path: BIRTHDAY_COLLECTION } });
    return { picks, card: null, problem: picks.length >= MIN_BIRTHDAY_DESIGNS ? undefined : 'No birthday designs to paint into' };
  }
  const campaign = offer.campaign_id ? ((await supabase.from('offer_campaigns').select('design_ids, collection_path').eq('id', offer.campaign_id).maybeSingle()).data as any) : null;
  return { picks: await pickOfferDesigns({ ...base, campaign }), card: null };
}

/** Generate a claimed offer (status 'generating'). Always leaves it in a final state: ready, failed or skipped. */
export async function generateOffer(supabase: SupabaseClient, offer: OfferRow, dataset: Dataset, now = Date.now()): Promise<GenerateOutcome> {
  const finish = async (patch: Record<string, unknown>) => { await supabase.from('preview_offers').update({ generated_at: new Date(now).toISOString(), ...patch }).eq('id', offer.id); };
  try {
    const allowed = await offerStillAllowed(supabase, offer, { needPhoto: true, now });
    if (!allowed.ok) { await finish({ status: 'skipped', error: allowed.reason }); return { status: 'skipped', error: allowed.reason }; }
    const source = await loadOfferSource(supabase, offer);
    if (!source) { await finish({ status: 'skipped', error: 'The photo is gone' }); return { status: 'skipped', error: 'The photo is gone' }; }

    const who = await personContext(supabase, offer, source);
    const { picks, card, problem } = await chooseDesigns(supabase, offer, dataset, source, who);
    if (problem && !picks.length || !hasEnoughPictures(picks.length)) {
      const error = problem ?? 'Not enough suitable designs to offer';
      // Nothing suitable to paint into is not the person's fault and costs nothing: skipped, not failed
      const skip = /No birthday designs|do not know if|No .* card for/.test(error);
      await finish({ status: skip ? 'skipped' : 'failed', error, designs: picks });
      return { status: skip ? 'skipped' : 'failed', error };
    }
    await supabase.from('preview_offers').update({ designs: picks }).eq('id', offer.id);

    const results = await Promise.all(picks.map(p => paintOne(supabase, offer, source, p.id, p.card ? card : null)));
    const good = results.filter(r => r.imageId && !r.error);
    const designs = picks.map((p, i) => ({ ...p, ...(results[i].imageId && !results[i].error ? { customImageId: results[i].imageId } : { error: results[i].error ?? 'Failed' }) }));
    // A zodiac offer is only worth sending with its card
    const cardFailed = picks.some((p, i) => p.card && (!results[i].imageId || results[i].error));
    if (!hasEnoughPictures(good.length) || cardFailed) {
      const error = results.filter(r => r.error).map(r => r.error).join('; ') || 'Too few pictures came out';
      await finish({ status: 'failed', error, designs, custom_image_ids: good.map(r => r.imageId) });
      return { status: 'failed', error, good: good.length };
    }
    await finish({ status: 'ready', error: null, designs: designs.filter(d => (d as any).customImageId), custom_image_ids: good.map(r => r.imageId) });
    return { status: 'ready', good: good.length };
  } catch (e: any) {
    const error = e instanceof Error ? e.message : 'Failed';
    await finish({ status: 'failed', error });
    return { status: 'failed', error };
  }
}

/** Admin: replace one picture of a 'ready' offer with the next-ranked design (counts towards the daily cap: see run.ts) */
export async function replacePicture(supabase: SupabaseClient, offerId: string, imageId: string, now = Date.now()): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: offer } = await supabase.from('preview_offers').select('*').eq('id', offerId).maybeSingle();
  if (!offer || (offer as any).status !== 'ready') return { ok: false, error: 'Only an offer waiting for approval can be changed' };
  const o = offer as unknown as OfferRow;
  const index = o.custom_image_ids.indexOf(imageId);
  if (index < 0) return { ok: false, error: 'That picture is not in this offer' };
  if (eventPassed(o.event_date, now)) return { ok: false, error: 'The day this offer was for has passed' };
  const allowed = await offerStillAllowed(supabase, o, { needPhoto: true, now });
  if (!allowed.ok) return { ok: false, error: allowed.reason };
  const source = await loadOfferSource(supabase, o);
  if (!source) return { ok: false, error: 'The photo is gone' };
  const who = await personContext(supabase, o, source);
  const dataset = await loadDataset(supabase, now);
  const kind = roundKind(o.round);
  // A zodiac offer's other pictures are the standard choice; its card (a single design) is not painted a second time
  const { picks: next } = await chooseDesigns(supabase, o, dataset, source, who, OFFER_PICTURES + o.designs.length + 5);
  const fresh = next.find(p => !o.designs.some((d: any) => d.id === p.id) && !(kind === 'zodiac' && p.card));
  if (!fresh) return { ok: false, error: 'There is no other suitable design to paint' };
  const r = await paintOne(supabase, o, source, fresh.id, null);
  if (!r.imageId || r.error) return { ok: false, error: r.error ?? 'It did not come out' };
  const designs = o.designs.map((d: any) => (d.customImageId === imageId ? { ...fresh, customImageId: r.imageId, replacedAt: new Date(now).toISOString() } : d));
  const ids = o.custom_image_ids.map(id => (id === imageId ? r.imageId! : id));
  await supabase.from('preview_offers').update({ designs, custom_image_ids: ids, generated_at: new Date(now).toISOString() }).eq('id', offerId).eq('status', 'ready');
  return { ok: true };
}
