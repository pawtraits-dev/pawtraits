/**
 * The customer painting pipeline, shared by the customise route (app/api/customers/custom-images/generate) and by
 * Offers (lib/offers/generate.ts). It was moved here from the route without changes to what it does:
 *   - design preparation: lookupDesign() / prepareDesign() / designOptions()
 *   - the background job: generateCustomImage(job) paints the pet into the design (Gemini), bakes slogan, words,
 *     caption plate and frame, stores the picture, builds the watermarked preview and marks the row 'complete'
 * The route adds what is only for visitors (guest limits, the record, the Meta event, social capture); Offers add their own
 * record (the kept photo) and never a Meta event (metaClient: null) or a free-preview slot.
 */
import { joinPetNames } from '@/lib/text/pet-names';
import { type SlotReplacement } from '@/lib/variation-prompt-builder';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { v2 as cloudinary } from 'cloudinary';
import { GeminiVariationService } from '@/lib/gemini-variation-service';
import { CloudinaryImageService } from '@/lib/cloudinary';
import { detectPetBreed } from '@/lib/customise/detect-breed';
import { letteringMatches, paintLettering, readKit, readShirt } from '@/lib/collections/kit-lettering';
import { kitLettering } from '@/lib/collections/sports-teams';
import { designMotto, bakeSlogan } from '@/lib/collections/slogan-server';
import { fillWords, petPhrase, readWords, type PictureWords } from '@/lib/picture-words';
import { bakeWords, breedPhrase } from '@/lib/picture-words-server';
import { bakeCaption, captionApplied, cleanPictureId, designCaption } from '@/lib/captions/server';
import type { Caption } from '@/lib/captions/caption';
import { bakeFrame, designCard } from '@/lib/frames/server';
import { frameTitle, DEFAULT_FRAME_STYLE, type FrameCard } from '@/lib/frames/frame';
import { generateWithUsage, type AiFeature } from '@/lib/ai/usage';
import { buildPaintingPrompt, paintingRequest, imageFrom, sniffImageType } from '@/lib/customise/painting';
import { sendMetaEvent } from '@/lib/tracking/meta-capi';
import type { MetaClient } from '@/lib/tracking/meta-request';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const cloudinaryService = new CloudinaryImageService();
export const geminiService = new GeminiVariationService();

export type ImageInput = { data: string; mimeType: string };
export type PetUpload = { publicId: string; stored: Promise<any | null> };
/** Milliseconds per step, saved in generation_metadata.timings (shown on Admin > AI costs) */
export type Timings = Record<string, number | Record<string, number>>;

export const PET_FOLDER = 'customer-custom-pets';

export async function fetchImage(url: string): Promise<ImageInput> {
  // Default Accept (*/*): Cloudinary sends the same cached file as always. Asking for WebP made a
  // new lossy file per design (slower, and a worse reference for Gemini).
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Image fetch failed (${res.status}): ${url}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  return { data: buffer.toString('base64'), mimeType: sniffImageType(buffer, res.headers.get('content-type') || 'image/png') };
}

/** Every customer who picks a design sends the same reference: keep recent ones in memory */
const referenceCache = new Map<string, Promise<ImageInput>>();
export function designReference(url: string): Promise<ImageInput> {
  let ref = referenceCache.get(url);
  if (!ref) {
    ref = fetchImage(url);
    ref.catch(() => referenceCache.delete(url));
    referenceCache.set(url, ref);
    if (referenceCache.size > 40) referenceCache.delete(referenceCache.keys().next().value as string);
  }
  return ref;
}

function uploadBuffer(buffer: Buffer, options: Record<string, unknown>): Promise<any> {
  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream({ resource_type: 'image', ...options }, (error, result) => (error ? reject(error) : resolve(result)))
      .end(buffer);
  });
}

/** Customer's photo, stored at the public id already saved on the record */
export function storePetPhoto(buffer: Buffer, publicId: string): Promise<any> {
  return uploadBuffer(buffer, {
    public_id: publicId,
    overwrite: false,
    transformation: [
      { width: 1024, height: 1024, crop: 'limit' },
      { quality: 'auto', fetch_format: 'auto' },
    ],
  });
}

/**
 * Customer previews use a fixed WebP file (every phone browser shows WebP). With f_auto, Safari and
 * Chrome got AVIF, which Cloudinary is slow to make the first time (~2.5s on the phone).
 */
const PREVIEW_FORMAT = process.env.CUSTOMER_PREVIEW_FORMAT || 'webp';

/** Have Cloudinary make the watermarked preview before the phone asks for it; ms taken */
async function buildPreview(url: string): Promise<number> {
  const started = Date.now();
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    await res.arrayBuffer();
    if (!res.ok) console.warn(`⚠️ Preview build returned ${res.status}: ${url}`);
  } catch (e) {
    console.warn('⚠️ Preview build failed (the phone will make it):', e);
  }
  return Date.now() - started;
}

export interface GenerateJob {
  customImageId: string;
  catalogImageUrl: string;
  designRef: Promise<ImageInput>;
  petImageUrls: string[];
  petUploads: (PetUpload | null)[];   // photos sent with this request (upload already under way)
  variationPromptTemplate?: string;
  themeName: string;
  styleName: string;
  catalogBreedName: string;
  aspectRatio?: string;
  customerPetBreedName?: string;
  aiAnalysisData?: any;
  sizeInstruction?: string;
  slotPlan?: SlotReplacement[];        // several pets: which photo replaces which pet (multi-pet plan phase 2)
  kit?: { name: string; number: number | null } | null;  // personalised football kit: the customer's name and number
  slogan?: string | null;              // team motto or the customer's own slogan, drawn on the right
  words?: { settings: PictureWords; phrase: string | null; animal: 'dog' | 'cat' | null } | null;  // words on the picture; phrase null = from the detected breed
  caption?: { dog: Caption | null; cat: Caption | null; animal: 'dog' | 'cat' | null; designAnimal: 'dog' | 'cat' } | null;  // type/sign plate; animal null = from the detected pet
  frame?: { dog: FrameCard | null; cat: FrameCard | null; animal: 'dog' | 'cat' | null; designAnimal: 'dog' | 'cat'; petName: string | null } | null;  // zodiac sign / tarot card frame; animal null = from the detected pet
  catalogImageId: string;
  metaClient: MetaClient | null;       // set only when the visitor accepted marketing cookies: Meta server event on completion (null = no event; offers always null)
  usageFeature?: AiFeature;            // what the Gemini call is recorded as on Admin > AI costs (default 'customer-painting'; offers: 'offer-preview')
  requestStarted: number;
  timings: Timings;
}

// Background generation: runs after the response has been sent
export async function generateCustomImage(job: GenerateJob): Promise<void> {
  const { customImageId, petImageUrls, timings } = job;
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const since = (t: number) => Date.now() - t;
  timings.queued = since(job.requestStarted) - (timings.request as number);

  try {
    let t = Date.now();
    // The design (usually cached) and the pets, in parallel. New photos go to Gemini exactly as
    // before: Cloudinary's 1024px, auto-rotated copy (the upload started as the request arrived)
    const [design, pets] = await Promise.all([
      job.designRef,
      Promise.all(petImageUrls.map(async (url, i) => {
        const upload = job.petUploads[i];
        if (!upload) return fetchImage(url);
        const stored = await upload.stored;
        if (!stored?.secure_url) throw new Error('Pet photo upload failed');
        return fetchImage(stored.secure_url);
      })),
    ]);
    timings.inputs = since(t);

    const ai = job.aiAnalysisData;
    const petCharacteristics = ai ? {
      pose: ai.physical_characteristics?.pose,
      gaze: ai.physical_characteristics?.gaze,
      expression: ai.physical_characteristics?.expression,
      detectedBreed: ai.breed_detected,
      detectedCoat: ai.coat_detected,
    } : undefined;

    const generationPrompt = buildPaintingPrompt({
      variationPromptTemplate: job.variationPromptTemplate,
      aspectRatio: job.aspectRatio,
      sizeInstruction: job.sizeInstruction,
      slotPlan: job.slotPlan,
      petCount: petImageUrls.length,
      themeName: job.themeName,
      styleName: job.styleName,
      breedName: job.customerPetBreedName || job.catalogBreedName,
      petCharacteristics, // AI-detected pose, gaze, expression
    }) + (job.kit ? `\n\n${kitLettering(job.kit.name, job.kit.number, { keepRest: false })}` : '');

    // Prompt, the design, then every pet photo; size from CUSTOMER_PREVIEW_SIZE (lib/customise/painting.ts)
    const request = paintingRequest({
      prompt: generationPrompt,
      catalogImageData: design.data,
      petImageData: pets.map((p) => p.data),
      aspectRatio: job.aspectRatio,
    });

    t = Date.now();
    const response = await generateWithUsage(geminiService.ai, { feature: job.usageFeature ?? 'customer-painting', customerImageId: customImageId }, request);
    timings.gemini = since(t);

    let generatedImageBase64 = imageFrom(response);
    if (!generatedImageBase64) throw new Error('No image data in Gemini response');

    // Personalised kit: read the shirt back; if the name or number came out wrong, one
    // lettering-only fix (kept only if it reads right)
    let kitResult: Record<string, unknown> | null = null;
    if (job.kit) {
      t = Date.now();
      const first = await readShirt(generatedImageBase64, 'image/png', { customerImageId: customImageId });
      kitResult = { ...job.kit, read: { name: first.name, number: first.number }, verified: letteringMatches(first, job.kit.name, job.kit.number), fixes: 0 };
      if (!kitResult.verified) {
        try {
          const fixed = await paintLettering(generatedImageBase64, job.kit.name, job.kit.number, { customerImageId: customImageId });
          const second = await readShirt(fixed, 'image/png', { customerImageId: customImageId });
          kitResult.fixes = 1;
          if (letteringMatches(second, job.kit.name, job.kit.number)) {
            generatedImageBase64 = fixed;
            kitResult = { ...kitResult, read: { name: second.name, number: second.number }, verified: true };
          }
        } catch (e) {
          console.warn('kit lettering fix failed', customImageId, e);
        }
      }
      timings.kit = since(t);
    }

    // Upload the painting as binary (a base64 data URI is a third bigger)
    t = Date.now();
    const uploaded = await uploadBuffer(Buffer.from(generatedImageBase64, 'base64'), { folder: 'customer-custom-images' });
    timings.save = since(t);
    let generatedImageUrl: string = uploaded.secure_url;
    let generatedCloudinaryId: string = uploaded.public_id;
    // Team motto / customer slogan: drawn on a stored copy (print files and downloads use it);
    // the clean painting is kept so the slogan can be redrawn (4K print masters)
    let sloganMeta: Record<string, unknown> | null = null;
    if (job.slogan) {
      t = Date.now();
      try {
        const baked = await bakeSlogan(generatedCloudinaryId, job.slogan);
        sloganMeta = { slogan: job.slogan, clean_cloudinary_id: generatedCloudinaryId, clean_url: generatedImageUrl };
        generatedCloudinaryId = baked.public_id;
        generatedImageUrl = baked.secure_url;
      } catch (e) {
        console.warn('slogan failed; keeping the painting without it', customImageId, e);
      }
      timings.slogan = since(t);
    }

    // Words on the picture ("Please be seated, Biscuit will see you shortly"): drawn on a stored
    // copy, the clean painting kept for print masters. The breed of an uploaded photo is detected now.
    let wordsMeta: Record<string, unknown> | null = null;
    if (job.words) {
      t = Date.now();
      try {
        let phrase = job.words.phrase;
        if (!phrase) {
          await detectPetBreed(customImageId, supabase);
          const { data: row } = await supabase.from('customer_custom_images').select('pet_breed_id, metadata').eq('id', customImageId).maybeSingle();
          const detected = (row?.metadata as any)?.detected_breed;
          const animal = detected?.animal === 'dog' || detected?.animal === 'cat' ? detected.animal : job.words.animal;
          phrase = row?.pet_breed_id && (detected?.confidence ?? 1) >= 0.5 ? await breedPhrase(supabase as any, row.pet_breed_id, animal) : petPhrase({ animal });
        }
        const text = fillWords(job.words.settings.template, phrase);
        const cleanId = (sloganMeta?.clean_cloudinary_id as string) ?? generatedCloudinaryId;
        const cleanUrl = (sloganMeta?.clean_url as string) ?? generatedImageUrl;
        const baked = await bakeWords(generatedCloudinaryId, job.words.settings, text, 'customer-custom-images');
        wordsMeta = { words_text: text, words: job.words.settings, clean_cloudinary_id: cleanId, clean_url: cleanUrl };
        generatedCloudinaryId = baked.public_id;
        generatedImageUrl = baked.secure_url;
      } catch (e) {
        console.warn('picture words failed; keeping the painting without them', customImageId, e);
      }
      timings.words = since(t);
    }

    // Caption plate (Pawsonality type or Zodiac sign + tagline), worded for their pet's animal:
    // drawn on a stored copy, the clean painting kept for print masters
    let captionMeta: Record<string, unknown> | null = null;
    if (job.caption) {
      t = Date.now();
      try {
        let animal = job.caption.animal;
        if (!animal) {
          const read = async () => ((await supabase.from('customer_custom_images').select('metadata').eq('id', customImageId).maybeSingle()).data?.metadata as any)?.detected_breed?.animal;
          let detected = await read();
          if (!detected) { await detectPetBreed(customImageId, supabase); detected = await read(); }
          animal = detected === 'cat' || detected === 'dog' ? detected : job.caption.designAnimal;
        }
        const caption = (animal === 'cat' ? job.caption.cat : job.caption.dog) ?? job.caption.dog ?? job.caption.cat;
        if (caption) {
          const cleanId = ((wordsMeta ?? sloganMeta)?.clean_cloudinary_id as string) ?? generatedCloudinaryId;
          const cleanUrl = ((wordsMeta ?? sloganMeta)?.clean_url as string) ?? generatedImageUrl;
          const baked = await bakeCaption(generatedCloudinaryId, caption, 'customer-custom-images');
          captionMeta = { caption, clean_cloudinary_id: cleanId, clean_url: cleanUrl };
          generatedCloudinaryId = baked.public_id;
          generatedImageUrl = baked.secure_url;
        }
      } catch (e) {
        console.warn('caption failed; keeping the painting without it', customImageId, e);
      }
      timings.caption = since(t);
    }

    // Framed card (zodiac sign or tarot card), worded for their pet's animal, with their pet's name
    // on the banner when they gave one. Drawn on a stored 2:3 copy; the picture before the frame
    // (base) and the clean painting are kept so print files can draw the frame per print shape.
    let frameMeta: Record<string, unknown> | null = null;
    if (job.frame) {
      t = Date.now();
      try {
        let animal = job.frame.animal;
        if (!animal) {
          const read = async () => ((await supabase.from('customer_custom_images').select('metadata').eq('id', customImageId).maybeSingle()).data?.metadata as any)?.detected_breed?.animal;
          let detected = await read();
          if (!detected) { await detectPetBreed(customImageId, supabase); detected = await read(); }
          animal = detected === 'cat' || detected === 'dog' ? detected : job.frame.designAnimal;
        }
        const base = (animal === 'cat' ? job.frame.cat : job.frame.dog) ?? job.frame.dog ?? job.frame.cat;
        if (base) {
          const card: FrameCard = { ...base, title: frameTitle(base.title, job.frame.petName) };
          const cleanId = ((wordsMeta ?? sloganMeta)?.clean_cloudinary_id as string) ?? generatedCloudinaryId;
          const cleanUrl = ((wordsMeta ?? sloganMeta)?.clean_url as string) ?? generatedImageUrl;
          const baked = await bakeFrame(generatedCloudinaryId, card, 'customer-custom-images');
          frameMeta = {
            frame: { style: DEFAULT_FRAME_STYLE, title: card.title, tagline: card.tagline, medallion: card.medallion, pet_name: job.frame.petName, base_cloudinary_id: generatedCloudinaryId, animal },
            clean_cloudinary_id: cleanId, clean_url: cleanUrl,
          };
          generatedCloudinaryId = baked.public_id;
          generatedImageUrl = baked.secure_url;
        }
      } catch (e) {
        console.warn('frame failed; keeping the painting without it', customImageId, e);
      }
      timings.frame = since(t);
    }

    // Watermarked preview for the customise page: made now, so the phone just downloads it
    const watermarkedUrl = cloudinaryService.getPublicVariantUrl(generatedCloudinaryId, 'catalog_watermarked', { format: PREVIEW_FORMAT });
    timings.preview = await buildPreview(watermarkedUrl);

    timings.server_total = since(job.requestStarted);
    t = Date.now();
    const { error: updateError } = await supabase
      .from('customer_custom_images')
      .update({
        generated_image_url: watermarkedUrl,  // watermarked URL for preview
        generated_cloudinary_id: generatedCloudinaryId,
        generation_prompt: generationPrompt,
        status: 'complete',
        generated_at: new Date().toISOString(),
        generation_metadata: {
          catalog_image_url: job.catalogImageUrl,
          pet_image_urls: petImageUrls,
          subject_count: petImageUrls.length,
          theme: job.themeName,
          style: job.styleName,
          model: request.model,
          image_size: request.config.imageConfig.imageSize,
          full_size_url: generatedImageUrl,  // full-size URL
          ...(kitResult ? { kit: kitResult } : {}),
          ...(sloganMeta ?? {}),
          ...(wordsMeta ?? {}),
          ...(captionMeta ?? {}),
          ...(frameMeta ?? {}),
          timings,
        },
      })
      .eq('id', customImageId);
    if (updateError) throw new Error(`Saving the result failed: ${updateError.message}`);
    const statusMs = since(t);

    console.log(`✅ Custom image ${customImageId}: ${JSON.stringify({ ...timings, status_update: statusMs })}`);

    // Meta Conversions API "CustomizeProduct": the preview is ready (the row just became 'complete').
    // This runs once per generation, in the same request that holds the visitor's cookies, so no repeat
    // on polls. event_id matches the browser pixel (CustomiseClient: "preview_" + custom image id). Never throws.
    if (job.metaClient) {
      await sendMetaEvent({
        name: 'CustomizeProduct', eventId: `preview_${customImageId}`,
        fbp: job.metaClient.fbp, fbc: job.metaClient.fbc, clientIp: job.metaClient.ip, userAgent: job.metaClient.ua, sourceUrl: job.metaClient.url,
        customData: { content_ids: [job.catalogImageId], content_type: 'product' },
      }).catch(() => {});
    }
  } catch (error) {
    console.error('❌ Error in generateCustomImage:', error);
    throw error;
  }
}

// ---------------------------------------------------------------------------------------------
// The design: lookup, its reference picture and its options (moved from the route as they were)

/** The catalogue columns a painting needs */
export const CATALOG_SELECT = `
        id,
        cloudinary_public_id,
        public_url,
        theme_id,
        style_id,
        breed_id,
        format_id,
        prompt_text,
        generation_parameters,
        subjects,
        breeds (id, name, animal_type),
        themes (id, name),
        styles (id, name),
        formats (id, name, aspect_ratio)
      `;

/** Look the design up (the route starts this early, while the customer / guest checks run) */
export function lookupDesign(supabase: SupabaseClient, catalogImageId: string) {
  return Promise.resolve(supabase
    .from('image_catalog')
    .select(CATALOG_SELECT)
    .eq('id', catalogImageId)
    .single());
}

export interface PreparedDesign {
  designKit: ReturnType<typeof readKit>;
  designWords: ReturnType<typeof readWords>;
  variationPromptTemplate: string | undefined;
  /** null: the design has no picture to paint from */
  catalogImageUrl: string | null;
  /** already fetching (cached across requests); null when there is no catalogImageUrl */
  designRef: Promise<ImageInput> | null;
}

/** Kit, words, prompt template and the reference picture of a design that was found */
export async function prepareDesign(supabase: SupabaseClient, catalogImage: any, catalogImageId: string): Promise<PreparedDesign> {
  const { data: kitRow } = await supabase.from('image_catalog').select('kit_personalisation').eq('id', catalogImageId).maybeSingle();
  const designKit = readKit((kitRow as any)?.kit_personalisation);
  // Separate read: works before the 2026-10-23 migration
  const { data: wordsRow } = await supabase.from('image_catalog').select('text_overlay').eq('id', catalogImageId).maybeSingle();
  const designWords = readWords((wordsRow as any)?.text_overlay);

  // Extract variation prompt template from Claude analysis
  const variationPromptTemplate = catalogImage.generation_parameters?.variation_prompt_template;
  if (!variationPromptTemplate) {
    console.warn('⚠️ No variation_prompt_template found in catalog image. Using fallback prompt.');
  }

  // Generate Cloudinary URL if we have the public_id
  let catalogImageUrl = catalogImage.public_url;
  // Gemini gets the design's original at 1024 px, with no watermark (the repeated paws would be
  // copied into the painting). CUSTOMER_DESIGN_IMAGE=watermarked goes back to the stored catalogue URL.
  if (process.env.CUSTOMER_DESIGN_IMAGE !== 'watermarked' && catalogImage.cloudinary_public_id) {
    // A design with words on it: Gemini paints from the text-free copy (the words are drawn after)
    // (and a design with the caption plate from the picture without it)
    const refId = designWords?.clean_public_id ?? (await cleanPictureId(supabase as any, catalogImageId, catalogImage.cloudinary_public_id)) ?? catalogImage.cloudinary_public_id;
    catalogImageUrl = cloudinary.url(refId, { width: 1024, crop: 'limit', format: 'jpg', quality: 90, secure: true });
  }
  if (!catalogImageUrl && catalogImage.cloudinary_public_id) {
    catalogImageUrl = cloudinaryService.getPublicVariantUrl(
      catalogImage.cloudinary_public_id,
      'full_size'
    );
    console.log('🔗 Generated catalog URL from Cloudinary ID:', catalogImageUrl);
  }
  if (!catalogImageUrl) return { designKit, designWords, variationPromptTemplate, catalogImageUrl: null, designRef: null };

  // Start fetching the design for Gemini now (cached across requests)
  const designRef = designReference(catalogImageUrl);
  designRef.catch(() => {}); // handled in the background job
  return { designKit, designWords, variationPromptTemplate, catalogImageUrl, designRef };
}

export interface DesignOptionsInput {
  catalogImage: any;
  catalogImageId: string;
  designKit: PreparedDesign['designKit'];
  designWords: PreparedDesign['designWords'];
  petCount: number;
  /** the saved pet (customise page, signed in); null for an uploaded photo */
  firstPet: any;
  petNames: (string | null | undefined)[];
  kitName: string | null;
  kitNumber: number | null | undefined;
  customSlogan: string | null;
  wordsName: string | null;
  captionRaw: string;
  frameOff: boolean;
  frameName: string | null;
}

/** What the design adds to a painting for this pet: personalised kit, slogan, words, caption plate, frame, and the pet name to store */
export async function designOptions(supabase: SupabaseClient, p: DesignOptionsInput) {
  const { catalogImage, catalogImageId, designKit, designWords, firstPet, kitName, kitNumber, customSlogan, wordsName, captionRaw, frameOff, frameName } = p;
  // Personalised kit: the customer's name and number replace the design's (one pet only)
  const kit = designKit && kitName && p.petCount === 1 ? { name: kitName, number: kitNumber ?? null } : null;
  // An uploaded photo has no name: the name on the shirt is the pet's name ("Biscuit")
  // Slogan: the customer's own, else the team motto (designs with "Show the team motto" ticked)
  const slogan = designKit?.slogan ? (customSlogan ?? await designMotto(supabase as any, catalogImageId).catch(() => null)) : null;
  // Words on the picture (one pet): their name, else their saved pet's breed, else detected later
  const words = designWords?.clean_public_id && p.petCount === 1 ? {
    settings: designWords,
    phrase: wordsName ?? (firstPet?.breed_id ? await breedPhrase(supabase as any, firstPet.breed_id, firstPet.animal_type ?? null) : null),
    animal: (firstPet?.animal_type ?? (catalogImage.breeds as any)?.animal_type ?? null) as 'dog' | 'cat' | null,
  } : null;
  const captionWanted = captionRaw === '1' ? true : captionRaw === '0' ? false : !!(await captionApplied(supabase as any, catalogImageId));
  const designCap = captionWanted ? await designCaption(supabase as any, catalogImageId).catch(() => null) : null;
  const caption = designCap && (designCap.dog || designCap.cat) ? {
    dog: designCap.dog, cat: designCap.cat, designAnimal: designCap.designAnimal,
    animal: (firstPet?.animal_type === 'cat' || firstPet?.animal_type === 'dog' ? firstPet.animal_type : null) as 'dog' | 'cat' | null,
  } : null;
  const designFrame = frameOff ? null : await designCard(supabase as any, catalogImageId).catch(() => null);
  const frame = designFrame && (designFrame.dog || designFrame.cat) ? {
    dog: designFrame.dog, cat: designFrame.cat, designAnimal: designFrame.designAnimal, petName: frameName,
    animal: (firstPet?.animal_type === 'cat' || firstPet?.animal_type === 'dog' ? firstPet.animal_type : null) as 'dog' | 'cat' | null,
  } : null;
  const kitPetName = kit ? kit.name.toLowerCase().replace(/(^|[\s'-])([a-z])/g, (_m: string, a: string, b: string) => a + b.toUpperCase()) : null;
  const petName = joinPetNames(p.petNames, kitPetName ?? (words && wordsName ? wordsName : undefined));
  return { kit, slogan, words, caption, frame, kitPetName, petName };
}
