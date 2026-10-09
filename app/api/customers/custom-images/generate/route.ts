import { NextRequest, NextResponse, after } from 'next/server';
import { joinPetNames } from '@/lib/text/pet-names';
import { buildMultiSubjectReplacementPrompt, type SlotReplacement } from '@/lib/variation-prompt-builder';
import { loadSlots, subjectsOf } from '@/lib/catalog/slots-server';
import { slotNow } from '@/lib/catalog/slots';
import { createClient } from '@supabase/supabase-js';
import { v2 as cloudinary } from 'cloudinary';
import { GeminiVariationService } from '@/lib/gemini-variation-service';
import { VariationPromptBuilder } from '@/lib/variation-prompt-builder';
import { CloudinaryImageService } from '@/lib/cloudinary';
import { buildSizeInstruction } from '@/lib/breed-size-mapping';
import { GEMINI_IMAGE_MODELS, toGeminiAspectRatio, geminiImageConfig, ratioOfImage } from '@/lib/gemini-models';
import { getRequester, setGuestCookie, clientIp } from '@/lib/guest/access';
import { hashIp } from '@/lib/qr/attribution';
import { getSetting } from '@/lib/app-settings';
import { capturePreviews } from '@/lib/social/capture';
import { generateWithUsage } from '@/lib/ai/usage';
import { buildPaintingPrompt, paintingRequest, imageFrom, sniffImageType } from '@/lib/customise/painting';
import { randomUUID } from 'crypto';

// Generation continues after the response (via after()); give it room to finish.
export const maxDuration = 300;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const cloudinaryService = new CloudinaryImageService();
const geminiService = new GeminiVariationService();
const promptBuilder = new VariationPromptBuilder();

type ImageInput = { data: string; mimeType: string };
type PetUpload = { publicId: string; stored: Promise<any | null> };
/** Milliseconds per step, saved in generation_metadata.timings (shown on Admin > AI costs) */
type Timings = Record<string, number | Record<string, number>>;

const PET_FOLDER = 'customer-custom-pets';

async function fetchImage(url: string): Promise<ImageInput> {
  // Default Accept (*/*): Cloudinary sends the same cached file as always. Asking for WebP made a
  // new lossy file per design (slower, and a worse reference for Gemini).
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Image fetch failed (${res.status}): ${url}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  return { data: buffer.toString('base64'), mimeType: sniffImageType(buffer, res.headers.get('content-type') || 'image/png') };
}

/** Every customer who picks a design sends the same reference: keep recent ones in memory */
const referenceCache = new Map<string, Promise<ImageInput>>();
function designReference(url: string): Promise<ImageInput> {
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
function storePetPhoto(buffer: Buffer, publicId: string): Promise<any> {
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

interface GenerateJob {
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
  requestStarted: number;
  timings: Timings;
}

// Background generation: runs after the response has been sent
async function generateCustomImage(job: GenerateJob): Promise<void> {
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
    });

    // Prompt, the design, then every pet photo; size from CUSTOMER_PREVIEW_SIZE (lib/customise/painting.ts)
    const request = paintingRequest({
      prompt: generationPrompt,
      catalogImageData: design.data,
      petImageData: pets.map((p) => p.data),
      aspectRatio: job.aspectRatio,
    });

    t = Date.now();
    const response = await generateWithUsage(geminiService.ai, { feature: 'customer-painting', customerImageId: customImageId }, request);
    timings.gemini = since(t);

    const generatedImageBase64 = imageFrom(response);
    if (!generatedImageBase64) throw new Error('No image data in Gemini response');

    // Upload the painting as binary (a base64 data URI is a third bigger)
    t = Date.now();
    const uploaded = await uploadBuffer(Buffer.from(generatedImageBase64, 'base64'), { folder: 'customer-custom-images' });
    timings.save = since(t);
    const generatedImageUrl: string = uploaded.secure_url;
    const generatedCloudinaryId: string = uploaded.public_id;

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
          timings,
        },
      })
      .eq('id', customImageId);
    if (updateError) throw new Error(`Saving the result failed: ${updateError.message}`);
    const statusMs = since(t);

    console.log(`✅ Custom image ${customImageId}: ${JSON.stringify({ ...timings, status_update: statusMs })}`);
  } catch (error) {
    console.error('❌ Error in generateCustomImage:', error);
    throw error;
  }
}

export async function POST(request: NextRequest) {
  const requestStarted = Date.now();
  const postTimings: Record<string, number> = {};
  let mark = requestStarted;
  const step = (name: string) => { const now = Date.now(); postTimings[name] = now - mark; mark = now; };
  console.log('🎨 [CUSTOM IMAGE GENERATE] Request received at /api/customers/custom-images/generate');
  console.log('🎨 [CUSTOM IMAGE GENERATE] Request method:', request.method);
  console.log('🎨 [CUSTOM IMAGE GENERATE] Request headers:', {
    contentType: request.headers.get('content-type'),
    contentLength: request.headers.get('content-length')
  });

  try {
    // Signed-in customer OR anonymous guest (pt_vid device cookie)
    const requester = await getRequester(request, { createGuest: true });
    const user = requester.user;
    const isGuest = !user;
    const ipHash = hashIp(clientIp(request));
    console.log('🎨 Custom image generation:', isGuest ? `guest ${requester.guestId}` : `user ${user!.email}`);

    // Use service role client for database operations
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Parse FormData
    const formData = await request.formData();
    const catalogImageId = formData.get('catalogImageId') as string;

    // Check for multi-subject support (petId1, petId2, etc. OR petPhoto1, petPhoto2, etc.)
    const petIds: (string | null)[] = [];
    const petPhotos: (File | null)[] = [];

    // Try to get multi-subject pets first (petId1, petId2, etc.)
    for (let i = 1; i <= 5; i++) { // Support up to 5 subjects
      const petId = formData.get(`petId${i}`) as string | null;
      const petPhoto = formData.get(`petPhoto${i}`) as File | null;

      if (petId || petPhoto) {
        petIds.push(petId);
        petPhotos.push(petPhoto);
        console.log(`📦 Found subject ${i}:`, { petId, hasPetPhoto: !!petPhoto });
      }
    }

    // Fallback to single pet (backward compatibility)
    if (petIds.length === 0 && petPhotos.length === 0) {
      const petId = formData.get('petId') as string | null;
      const petPhoto = formData.get('petPhoto') as File | null;

      if (petId || petPhoto) {
        petIds.push(petId);
        petPhotos.push(petPhoto);
        console.log('📦 Using single pet (backward compatible):', { petId, hasPetPhoto: !!petPhoto });
      }
    }

    console.log('📦 FormData received:', {
      catalogImageId,
      subjectCount: petIds.length,
      petIds,
      petPhotoCount: petPhotos.filter(p => p !== null).length
    });

    if (!catalogImageId) {
      return NextResponse.json(
        { error: 'Catalog image ID is required' },
        { status: 400 }
      );
    }

    if (petIds.length === 0 || petIds.every(id => !id) && petPhotos.every(photo => !photo)) {
      return NextResponse.json(
        { error: 'At least one pet ID or pet photo is required' },
        { status: 400 }
      );
    }

    // Look the design up while the customer / guest checks run
    const catalogLookup = Promise.resolve(supabase
      .from('image_catalog')
      .select(`
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
        breeds (id, name),
        themes (id, name),
        styles (id, name),
        formats (id, name, aspect_ratio)
      `)
      .eq('id', catalogImageId)
      .single());
    step('auth_and_form');

    let customer: { id: string; email: string } | null = null;
    if (!isGuest) {
      const { data: customerRow, error: customerError } = await supabase
        .from('customers')
        .select('id, email')
        .eq('email', user!.email)
        .single();
      if (customerError || !customerRow) {
        return NextResponse.json({ error: 'Customer profile not found' }, { status: 404 });
      }
      customer = customerRow;
    } else {
      // Guests can only upload photos (saved pets need an account)
      if (petIds.some(id => !!id)) {
        return NextResponse.json({ error: 'Please upload a photo of your pet' }, { status: 400 });
      }
      // Daily free-preview limits (admin-controlled): per device, with a high per-IP backstop
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const [deviceLimit, ipLimit] = await Promise.all([
        getSetting('guest_preview_daily_limit'),
        getSetting('guest_preview_ip_daily_limit'),
      ]);
      const [{ count: deviceCount }, ipResult] = await Promise.all([
        supabase
          .from('customer_custom_images')
          .select('id', { count: 'exact', head: true })
          .eq('guest_session_id', requester.guestId!)
          .is('customer_id', null)
          .gte('created_at', since),
        ipHash
          ? supabase
              .from('customer_custom_images')
              .select('id', { count: 'exact', head: true })
              .eq('ip_hash', ipHash)
              .is('customer_id', null)
              .gte('created_at', since)
          : Promise.resolve({ count: 0 }),
      ]);
      const ipCount = ipResult.count ?? 0;
      if ((deviceCount ?? 0) >= deviceLimit || ipCount >= ipLimit) {
        console.warn('🚫 Guest preview limit reached', { guestId: requester.guestId, deviceCount, ipCount, deviceLimit, ipLimit });
        return setGuestCookie(NextResponse.json({
          error: "You've used today's free previews. Create a free account (or come back tomorrow) to make more.",
          code: 'GUEST_LIMIT_REACHED',
          limit: deviceLimit,
        }, { status: 429 }), requester);
      }
    }

    // Get catalog image details
    console.log('🖼️ Fetching catalog image:', catalogImageId);
    const { data: catalogImage, error: catalogError } = await catalogLookup;

    step('checks');

    if (catalogError) {
      console.error('❌ Catalog image fetch error:', catalogError);
      return NextResponse.json(
        { error: 'Catalog image not found', details: catalogError.message },
        { status: 404 }
      );
    }

    if (!catalogImage) {
      console.error('❌ Catalog image not found for ID:', catalogImageId);
      return NextResponse.json(
        { error: 'Catalog image not found' },
        { status: 404 }
      );
    }

    console.log('✅ Catalog image found:', {
      id: catalogImage.id,
      hasCloudinaryId: !!catalogImage.cloudinary_public_id,
      hasPublicUrl: !!catalogImage.public_url,
      theme: catalogImage.themes?.name,
      style: catalogImage.styles?.name,
      format: catalogImage.formats?.name,
      aspectRatio: catalogImage.formats?.aspect_ratio,
      hasGenerationParams: !!catalogImage.generation_parameters
    });

    // CRITICAL: Log aspect ratio for debugging
    if (catalogImage.formats?.aspect_ratio) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🎯 ASPECT RATIO FROM DATABASE:', catalogImage.formats.aspect_ratio);
      console.log('🎯 FORMAT NAME:', catalogImage.formats.name);
      const [w, h] = catalogImage.formats.aspect_ratio.split(':').map(Number);
      if (w > h) {
        console.log('🎯 ORIENTATION: LANDSCAPE');
        console.log(`🎯 OUTPUT MUST BE: ${catalogImage.formats.aspect_ratio} (width:height)`);
      } else if (h > w) {
        console.log('🎯 ORIENTATION: PORTRAIT');
        console.log(`🎯 OUTPUT MUST BE: ${catalogImage.formats.aspect_ratio} (width:height)`);
      } else {
        console.log('🎯 ORIENTATION: SQUARE');
        console.log(`🎯 OUTPUT MUST BE: ${catalogImage.formats.aspect_ratio} (width:height)`);
      }
      console.log('🎯 THIS IS THE ONLY ACCEPTABLE FORMAT FOR THE GENERATED IMAGE');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    }

    // Extract variation prompt template from Claude analysis
    const variationPromptTemplate = catalogImage.generation_parameters?.variation_prompt_template;
    if (!variationPromptTemplate) {
      console.warn('⚠️ No variation_prompt_template found in catalog image. Using fallback prompt.');
    }

    // Generate Cloudinary URL if we have the public_id
    let catalogImageUrl = catalogImage.public_url;
    // CUSTOMER_DESIGN_IMAGE=clean (Vercel): send Gemini the design's original at 1024 px, with no
    // watermark. Default: the catalogue URL as before (watermarked 800 px or 400 px on older designs).
    if (process.env.CUSTOMER_DESIGN_IMAGE === 'clean' && catalogImage.cloudinary_public_id) {
      catalogImageUrl = cloudinary.url(catalogImage.cloudinary_public_id, { width: 1024, crop: 'limit', format: 'jpg', quality: 90, secure: true });
    }
    if (!catalogImageUrl && catalogImage.cloudinary_public_id) {
      catalogImageUrl = cloudinaryService.getPublicVariantUrl(
        catalogImage.cloudinary_public_id,
        'full_size'
      );
      console.log('🔗 Generated catalog URL from Cloudinary ID:', catalogImageUrl);
    }

    if (!catalogImageUrl) {
      console.error('❌ No catalog image URL available');
      return NextResponse.json(
        { error: 'Catalog image URL not available' },
        { status: 500 }
      );
    }

    // Start fetching the design for Gemini now (cached across requests)
    const designRef = designReference(catalogImageUrl);
    designRef.catch(() => {}); // handled in the background job

    // Process all pets (multi-subject support)
    const petImageUrls: string[] = [];
    const petUploads: (PetUpload | null)[] = [];
    const petCloudinaryIds: string[] = [];
    const petsData: any[] = [];

    for (let i = 0; i < petIds.length; i++) {
      const petId = petIds[i];
      const petPhoto = petPhotos[i];

      if (petId) {
        // Use existing pet
        console.log(`🐕 Fetching pet data for subject ${i + 1}, petId:`, petId, 'userId:', user?.id);
        const { data: pet, error: petError } = await supabase
          .from('pets')
          .select(`
            id,
            name,
            breed_id,
            coat_id,
            weight,
            animal_type,
            primary_photo_url,
            ai_analysis_data,
            breeds (id, name, slug),
            coats (id, name, description)
          `)
          .eq('id', petId)
          .eq('user_id', user!.id)
          .single();

        if (petError || !pet) {
          console.error(`❌ Pet lookup failed for subject ${i + 1}:`, { petError, hasPet: !!pet, petId, userId: user?.id });
          return NextResponse.json(
            { error: `Pet ${i + 1} not found`, details: petError?.message || 'Pet does not exist or does not belong to user' },
            { status: 404 }
          );
        }

        console.log(`✅ Pet ${i + 1} found:`, { petId: pet.id, petName: pet.name, hasPhotoUrl: !!pet.primary_photo_url });
        petsData.push(pet);
        petImageUrls.push(pet.primary_photo_url);
        petUploads.push(null);

        // Extract Cloudinary ID from URL if it's a Cloudinary URL
        if (pet.primary_photo_url.includes('cloudinary.com')) {
          const urlParts = pet.primary_photo_url.split('/');
          const uploadIndex = urlParts.indexOf('upload');
          if (uploadIndex !== -1 && uploadIndex + 2 < urlParts.length) {
            const cloudinaryId = urlParts.slice(uploadIndex + 2).join('/').split('.')[0];
            petCloudinaryIds.push(cloudinaryId);
          } else {
            petCloudinaryIds.push('unknown');
          }
        } else {
          petCloudinaryIds.push('non-cloudinary');
        }
      } else if (petPhoto) {
        // New photo: upload starts now (not awaited) under a public id chosen here, so the record
        // can point at it and the rest of the request carries on while it uploads
        const buffer = Buffer.from(await petPhoto.arrayBuffer());
        const publicId = `${PET_FOLDER}/${randomUUID()}`;
        const stored = storePetPhoto(buffer, publicId).catch((e) => { console.error(`❌ Pet photo upload failed (${publicId}):`, e); return null; });
        petUploads.push({ publicId, stored });
        petImageUrls.push(cloudinary.url(publicId, { secure: true }));
        petCloudinaryIds.push(publicId);
        petsData.push(null); // No pet data for uploaded photos
      }
    }

    // Validate that we have pet image data
    if (petImageUrls.length === 0 || petCloudinaryIds.length === 0) {
      console.error('❌ No pet images processed:', { urlCount: petImageUrls.length, idCount: petCloudinaryIds.length });
      return NextResponse.json(
        { error: 'Failed to process pet images' },
        { status: 400 }
      );
    }

    console.log('✅ Pet image data validated:', {
      subjectCount: petImageUrls.length,
      petNames: petsData.map(p => p?.name || 'Uploaded Pet').join(', ')
    });

    // Calculate relative size instruction for multi-subject images
    let sizeInstruction: string | undefined;
    if (petImageUrls.length > 1) {
      const petSizeData = petsData.map(pet => ({
        name: pet?.name || 'Pet',
        breedSlug: pet?.breeds?.slug,
        weight: pet?.weight ? Number(pet.weight) : undefined,
        animalType: (pet?.animal_type || 'dog') as 'dog' | 'cat'
      }));

      sizeInstruction = buildSizeInstruction(petSizeData);
      console.log('📏 Size instruction generated:', sizeInstruction);
    }

    // Create custom image record in database (use first pet for backward compatibility)
    const firstPet = petsData[0];
    const firstPetId = petIds[0];

    const { data: customImage, error: insertError } = await supabase
      .from('customer_custom_images')
      .insert({
        customer_id: customer?.id ?? null,
        customer_email: customer?.email ?? null,
        guest_session_id: requester.guestId,   // device that made it (guests and signed-in)
        ip_hash: ipHash,
        catalog_image_id: catalogImageId,
        pet_id: firstPetId || null,
        // Every pet's name ("Biscuit & Luna"); the first pet's details stay in pet_id / breed / coat
        pet_name: joinPetNames(petsData.map(p => p?.name)),
        pet_breed_id: firstPet?.breed_id || null,
        pet_coat_id: firstPet?.coat_id || null,
        pet_image_url: petImageUrls[0],
        pet_cloudinary_id: petCloudinaryIds[0],
        status: 'generating',
        is_public: true, // Make shareable by default
        metadata: {
          catalog_theme: catalogImage.themes?.name,
          catalog_style: catalogImage.styles?.name,
          catalog_breed: catalogImage.breeds?.name,
          subject_count: petImageUrls.length,
          all_pet_ids: petIds.filter(id => id !== null),
          all_pet_names: petsData.map(p => p?.name || 'Uploaded Pet'),
        }
      })
      .select(`
        id,
        generated_image_url,
        share_token,
        status,
        created_at
      `)
      .single();

    if (insertError) {
      console.error('❌ Error creating custom image record:', insertError);
      return NextResponse.json(
        { error: 'Failed to create custom image record' },
        { status: 500 }
      );
    }

    console.log('✅ Custom image record created:', customImage.id);
    console.log('📦 Custom image object:', JSON.stringify(customImage));

    step('record');

    // Several pets: photo N replaces slot N (left to right), named in the prompt
    let slotPlan: SlotReplacement[] | undefined;
    if (petImageUrls.length > 1) {
      const slots = await loadSlots(supabase, subjectsOf(catalogImage as any));
      if (slots.length === petImageUrls.length) {
        slotPlan = slots.map((slot, i) => ({
          label: slot.label,
          now: slotNow(slot),
          newPet: petsData[i] ? { name: petsData[i].name, breed: petsData[i].breeds?.name, animalType: petsData[i].animal_type } : undefined,
        }));
      } else {
        console.warn(`⚠️ ${petImageUrls.length} photos for ${slots.length} pets in the design; using the general prompt`);
      }
    }

    step('slots');
    const timings: Timings = { post: postTimings };

    // Run generation after the response is sent; after() keeps the function alive until it finishes
    after(() =>
      generateCustomImage({
        customImageId: customImage.id,
        catalogImageUrl,
        designRef,
        petImageUrls, // every pet's photo (multi-subject)
        petUploads,
        variationPromptTemplate,
        themeName: catalogImage.themes?.name || 'Custom',
        styleName: catalogImage.styles?.name || 'Portrait',
        catalogBreedName: catalogImage.breeds?.name || 'Pet',
        aspectRatio: catalogImage.formats?.aspect_ratio, // from the design's format
        customerPetBreedName: firstPet?.breeds?.name,
        aiAnalysisData: firstPet?.ai_analysis_data,
        sizeInstruction, // relative sizes for several pets
        slotPlan,
        requestStarted,
        timings,
      }).then(() => capturePreviews({ ids: [customImage.id] })) // social loop: only if "Include free previews" is on
      .catch(async (error) => {
        console.error('❌ Error in background generation:', error);
        await supabase
          .from('customer_custom_images')
          .update({
            status: 'failed',
            error_message: error instanceof Error ? error.message : 'Generation failed'
          })
          .eq('id', customImage.id);
      })
    );

    timings.request = Date.now() - requestStarted;
    const response = {
      ...customImage,
      status: 'generating'
    };
    console.log('🚀 Returning response:', JSON.stringify(response));

    return setGuestCookie(NextResponse.json(response), requester);

  } catch (error) {
    console.error('❌ Error in custom image generation:', error);
    console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace');

    // Return proper error response
    return NextResponse.json(
      {
        error: 'Failed to generate custom image',
        details: error instanceof Error ? error.message : 'Unknown error',
        stack: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : undefined) : undefined
      },
      { status: 500 }
    );
  }
}
