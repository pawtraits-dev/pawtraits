/**
 * Everything the design page (/customise/[imageId]) needs about one public design: the picture,
 * breed, frame / caption / words / kit info and mug mock-ups. One source of truth for both the
 * public API route (/api/public/catalog-images/[id]) and the server-rendered design page, so the
 * first HTML can already carry the picture. Nothing here depends on who is asking (no cookies).
 */
import { createClient } from '@supabase/supabase-js';
import { CloudinaryImageService } from '@/lib/cloudinary';
import { loadSlots, subjectsOf } from '@/lib/catalog/slots-server';
import { readKit } from '@/lib/collections/kit-lettering';
import { designMotto } from '@/lib/collections/slogan-server';
import { wrapMockups } from '@/lib/mugs/mockup';
import { sloganLayer } from '@/lib/collections/slogan';
import { readWords, wordsLayer, WORDS_TOKEN } from '@/lib/picture-words';
import { breedPhrase } from '@/lib/picture-words-server';
import { captionLayer, readCaptionOverlay } from '@/lib/captions/caption';
import { designCaption, ensureSymbols } from '@/lib/captions/server';
import { designCard, ensureFrameAssets, frameShapeUrls } from '@/lib/frames/server';
import { FRAME_MAX, readFrameOverlay } from '@/lib/frames/frame';

// Use service role client to bypass RLS for public catalog data
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const cloudinaryService = new CloudinaryImageService();

export type DesignPageData = any;

export type DesignPageResult =
  | { status: 'ok'; data: DesignPageData }
  | { status: 'not_found' };

/** Loads the design; 'not_found' when it does not exist or is not public; throws on any other failure. */
export async function loadDesignPageData(id: string): Promise<DesignPageResult> {
  // Fetch catalog image with related metadata
  const { data: catalogImage, error } = await db
    .from('image_catalog')
    .select(`
      id,
      cloudinary_public_id,
      prompt_text,
      description,
      breed_id,
      theme_id,
      style_id,
      format_id,
      generation_parameters,
      subjects,
      breed:breeds(
        id,
        name,
        animal_type
      ),
      theme:themes(
        id,
        name,
        base_prompt_template
      ),
      style:styles(
        id,
        name,
        prompt_suffix
      ),
      format:formats(
        id,
        name,
        aspect_ratio
      )
    `)
    .eq('id', id)
    .eq('is_public', true)
    .single();

  if (error) {
    console.error('❌ [CATALOG API] Database error:', error);

    if (error.code === 'PGRST116') return { status: 'not_found' };

    throw error;
  }


  // Generate Cloudinary URLs for different variants
  const imageUrl = catalogImage.cloudinary_public_id
    ? cloudinaryService.getPublicVariantUrl(catalogImage.cloudinary_public_id, 'full_size')
    : null;

  const thumbnailUrl = catalogImage.cloudinary_public_id
    ? cloudinaryService.getPublicVariantUrl(catalogImage.cloudinary_public_id, 'thumbnail')
    : null;


  // How many pets: image_catalog.subjects (kept in step with generation_parameters by a trigger,
  // multi-pet plan phase 1), else generation_parameters for anything older
  const subjectCount = Math.max(1,
    Array.isArray(catalogImage.subjects) ? catalogImage.subjects.length : 0,
    Array.isArray(catalogImage.generation_parameters?.subjects) ? catalogImage.generation_parameters.subjects.length : 0);
  const isMultiSubject = subjectCount > 1;
  // Who goes where (multi-pet plan phase 2): one slot per pet, left to right, photo N → slot N
  const slots = isMultiSubject ? await loadSlots(db, subjectsOf(catalogImage)) : [];

  // Personalised football kit: the customer chooses the name and number on the shirt (one-pet
  // designs only). Separate read so the page still works before the 2026-10-20 migration.
  const { data: kitRow } = await db.from('image_catalog').select('kit_personalisation').eq('id', catalogImage.id).maybeSingle();
  const kit = !isMultiSubject ? readKit((kitRow as any)?.kit_personalisation) : null;
  // Team motto as big text on the right (designs with "Show the team motto" ticked)
  const motto = kit?.slogan ? await designMotto(db as any, catalogImage.id).catch(() => null) : null;
  const displayUrl = motto && catalogImage.cloudinary_public_id
    ? cloudinaryService.getPublicVariantUrl(catalogImage.cloudinary_public_id, 'full_size', { overlay: sloganLayer(motto) })
    : imageUrl;

  // Words on the picture ("Please be seated, {pet} will see you shortly"): the customer chooses
  // their pet's name or breed; the page previews it live from this URL template (one-pet designs)
  const { data: wordsRow } = await db.from('image_catalog').select('text_overlay').eq('id', catalogImage.id).maybeSingle();
  const pictureWords = !isMultiSubject ? readWords((wordsRow as any)?.text_overlay) : null;
  const words = pictureWords?.clean_public_id ? {
    template: pictureWords.template,
    phrase: await breedPhrase(db as any, catalogImage.breed_id),
    previewUrl: cloudinaryService.getPublicVariantUrl(pictureWords.clean_public_id, 'catalog_watermarked', { overlay: wordsLayer(pictureWords, WORDS_TOKEN), format: 'jpg' }),
    token: WORDS_TOKEN,
  } : null;

  // Caption plate (Pawsonality type or Zodiac sign + tagline): the customer can have it on their
  // picture or not; on by default when the design shows it. Previews on the clean picture.
  let caption: any = null;
  try {
    const cap = await designCaption(db as any, catalogImage.id);
    if (cap && (cap.dog || cap.cat)) {
      const { data: capRow } = await db.from('image_catalog').select('caption_overlay').eq('id', catalogImage.id).maybeSingle();
      const overlay = readCaptionOverlay((capRow as any)?.caption_overlay);
      const clean = overlay?.applied ? overlay.clean_public_id : catalogImage.cloudinary_public_id;
      const ratio = String((catalogImage.format as any)?.aspect_ratio || '2:3').split(':').map(Number);
      const aspect = ratio[0] > 0 && ratio[1] > 0 ? ratio[0] / ratio[1] : 2 / 3;
      if ((cap.dog?.symbol || cap.cat?.symbol)) await ensureSymbols().catch(() => null);
      const preview = (c: typeof cap.dog) => (c && clean ? cloudinaryService.getPublicVariantUrl(clean, 'catalog_watermarked', { overlay: captionLayer(c, aspect), format: 'jpg' }) : null);
      caption = { dog: cap.dog, cat: cap.cat, designAnimal: cap.designAnimal, on: !!overlay?.applied, previews: { dog: preview(cap.dog), cat: preview(cap.cat) } };
    }
  } catch (e) {
    console.warn('caption info failed', catalogImage.id, e);
  }

  // Framed card (zodiac sign or tarot card): always on for the customer; they may add their pet's
  // name to the banner. Previews and per-size thumbnails are drawn from the clean picture, watermarked.
  let frame: any = null;
  try {
    const fc = await designCard(db as any, catalogImage.id);
    if (fc && (fc.dog || fc.cat)) {
      const { data: frRow, error: frErr } = await db.from('image_catalog').select('frame_overlay').eq('id', catalogImage.id).maybeSingle();
      const fo = frErr ? null : readFrameOverlay((frRow as any)?.frame_overlay);
      const clean = fo?.clean_public_id ?? catalogImage.cloudinary_public_id;
      await ensureFrameAssets().catch(() => null);
      const previewOf = (c: typeof fc.dog) => (c && clean ? frameShapeUrls(clean, c, 400)['2:3'] : null);
      const a = fo?.applied;
      frame = {
        dog: fc.dog, cat: fc.cat, designAnimal: fc.designAnimal, nameMax: FRAME_MAX.pet,
        on: !!a, previews: { dog: previewOf(fc.dog), cat: previewOf(fc.cat) },
        // "With frame" / "Without frame" on the design's picture: both watermarked like every preview
        framedUrl: a ? displayUrl : (clean && fc.card ? frameShapeUrls(clean, fc.card, 1200)['2:3'] : displayUrl),
        cleanUrl: clean ? cloudinaryService.getPublicVariantUrl(clean, 'full_size') : null,
        // Buy-sheet thumbnails, one per print shape, only when the design itself shows the frame
        thumbs: a && clean ? frameShapeUrls(clean, { title: a.title, tagline: a.tagline, medallion: a.medallion }, 240) : null,
      };
    }
  } catch (e) {
    console.warn('frame info failed', catalogImage.id, e);
  }

  // Wraparound (2:1) designs: the design on the mug photos, both sides, motto included
  const isWrap = (catalogImage.format as any)?.aspect_ratio === '2:1' || (Array.isArray(catalogImage.format) && (catalogImage.format as any)[0]?.aspect_ratio === '2:1');
  const mugMockups = isWrap && catalogImage.cloudinary_public_id
    ? await wrapMockups(catalogImage.cloudinary_public_id, { overlay: motto ? sloganLayer(motto) : undefined }).catch(() => ({}))
    : {};

  // Format response
  const response = {
    mugMockups,
    kit: kit ? { name: kit.name, number: kit.number, motto } : null,
    words,
    caption,
    frame,
    id: catalogImage.id,
    cloudinaryPublicId: catalogImage.cloudinary_public_id,
    imageUrl: displayUrl,
    thumbnailUrl,
    prompt: catalogImage.prompt_text,
    description: catalogImage.description,
    isMultiSubject,
    subjectCount,
    slots: slots.map(s => ({ label: s.label, breedName: s.breedName, animalType: s.animalType, pose: s.pose })),
    breed: catalogImage.breed ? {
      id: catalogImage.breed.id,
      name: catalogImage.breed.name,
      displayName: catalogImage.breed.name, // Use name as displayName
      animalType: catalogImage.breed.animal_type
    } : null,
    theme: catalogImage.theme ? {
      id: catalogImage.theme.id,
      name: catalogImage.theme.name,
      displayName: catalogImage.theme.name // Use name as displayName
    } : null,
    style: catalogImage.style ? {
      id: catalogImage.style.id,
      name: catalogImage.style.name,
      displayName: catalogImage.style.name // Use name as displayName
    } : null,
    format: catalogImage.format ? {
      id: catalogImage.format.id,
      name: catalogImage.format.name,
      aspectRatio: catalogImage.format.aspect_ratio
    } : null
  };

  return { status: 'ok', data: response };
}
