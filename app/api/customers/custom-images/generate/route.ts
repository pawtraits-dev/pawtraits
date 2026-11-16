import { NextRequest, NextResponse, after } from 'next/server';
import { buildSizeInstruction } from '@/lib/breed-size-mapping';
import { loadSlots, subjectsOf } from '@/lib/catalog/slots-server';
import { slotNow } from '@/lib/catalog/slots';
import { createClient } from '@supabase/supabase-js';
import { v2 as cloudinary } from 'cloudinary';
import { type SlotReplacement } from '@/lib/variation-prompt-builder';
import { detectPetBreed } from '@/lib/customise/detect-breed';
import { cleanKitName, cleanKitNumber } from '@/lib/collections/sports-teams';
import { cleanSlogan } from '@/lib/collections/slogan';
import { cleanPetName } from '@/lib/picture-words';
import { FRAME_MAX } from '@/lib/frames/frame';
import { getRequester, setGuestCookie, clientIp } from '@/lib/guest/access';
import { hashIp } from '@/lib/qr/attribution';
import { getSetting } from '@/lib/app-settings';
import { capturePreviews } from '@/lib/social/capture';
import { randomUUID } from 'crypto';
import { metaClientFromRequest } from '@/lib/tracking/meta-request';
import {
  PET_FOLDER, designOptions, generateCustomImage, lookupDesign, prepareDesign, storePetPhoto,
  type PetUpload, type Timings,
} from '@/lib/customise/generate-job';

// Generation continues after the response (via after()); give it room to finish.
export const maxDuration = 300;

// The painting pipeline (design lookup, the background job, previews) lives in lib/customise/generate-job.ts,
// shared with Offers (lib/offers/generate.ts). Importing it also configures Cloudinary.

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
    // Where the visitor came from (?src= on the customise page), for Admin > Customisations
    const sourceRaw = String(formData.get('source') || '').toLowerCase();
    const source = /^[a-z0-9_-]{1,32}$/.test(sourceRaw) ? sourceRaw : 'direct';
    // Personalised football kit (only used when the design has one)
    const kitNameRaw = formData.get('kitName');
    const kitName = kitNameRaw ? cleanKitName(kitNameRaw) : null;
    const kitNumber = cleanKitNumber(formData.get('kitNumber') ?? '');
    const sloganRaw = formData.get('slogan');
    const customSlogan = sloganRaw && String(sloganRaw).trim() ? cleanSlogan(sloganRaw) : null;
    if (sloganRaw && String(sloganRaw).trim() && !customSlogan) {
      return NextResponse.json({ error: 'Please check the slogan: up to 32 letters, numbers and simple punctuation, and nothing rude.' }, { status: 400 });
    }
    // Words on the picture: their pet's name, or (left empty) their breed
    const wordsNameRaw = formData.get('wordsName');
    const wordsName = wordsNameRaw && String(wordsNameRaw).trim() ? cleanPetName(wordsNameRaw) : null;
    if (wordsNameRaw && String(wordsNameRaw).trim() && !wordsName) {
      return NextResponse.json({ error: 'Please check the name for the picture: letters only (spaces, hyphens and apostrophes are fine), up to 16, and nothing rude.' }, { status: 400 });
    }
    // Caption plate (type/sign + tagline): '1' on, '0' off; not sent = as the design shows it
    const captionRaw = String(formData.get('caption') ?? '');
    // Framed cards (zodiac sign / tarot card): always framed; the pet's name on the banner is optional
    // frame=off: "Without frame": an ordinary portrait from the clean picture (no frame, no pet name on a card)
    const frameOff = String(formData.get('frame') ?? '') === 'off';
    const frameNameRaw = frameOff ? null : formData.get('frameName');
    const frameName = frameNameRaw && String(frameNameRaw).trim() ? (cleanPetName(frameNameRaw) ?? '').slice(0, FRAME_MAX.pet).trim() || null : null;
    if (frameNameRaw && String(frameNameRaw).trim() && !frameName) {
      return NextResponse.json({ error: 'Please check the name for the card: letters only (spaces, hyphens and apostrophes are fine), up to 14, and nothing rude.' }, { status: 400 });
    }
    if (kitNameRaw && (!kitName || kitNumber === undefined)) {
      return NextResponse.json({ error: 'Please check the name and number for the shirt: letters only for the name (up to 12), and a number from 0 to 99.' }, { status: 400 });
    }

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
    const catalogLookup = lookupDesign(supabase, catalogImageId);
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
          .is('metadata->offer', null)   // pictures painted for Offers (lib/offers/) are not the visitor's free previews
          .gte('created_at', since),
        ipHash
          ? supabase
              .from('customer_custom_images')
              .select('id', { count: 'exact', head: true })
              .eq('ip_hash', ipHash)
              .is('customer_id', null)
              .is('metadata->offer', null)
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

    const { designKit, designWords, variationPromptTemplate, catalogImageUrl, designRef } = await prepareDesign(supabase, catalogImage, catalogImageId);
    if (!catalogImageUrl) {
      console.error('❌ No catalog image URL available');
      return NextResponse.json(
        { error: 'Catalog image URL not available' },
        { status: 500 }
      );
    }

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

    const firstPet = petsData[0];
    const { kit, slogan, words, caption, frame, petName } = await designOptions(supabase, {
      catalogImage, catalogImageId, designKit, designWords, petCount: petImageUrls.length, firstPet,
      petNames: petsData.map(p => p?.name), kitName, kitNumber, customSlogan, wordsName, captionRaw, frameOff, frameName,
    });
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
        pet_name: petName,
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
          source,
          ...(firstPet?.breed_id ? { breed_source: 'profile' } : {}),
          ...(kit ? { kit } : {}),
          ...(slogan ? { slogan } : {}),
          ...(words ? { words: { name: wordsName, phrase: words.phrase } } : {}),
          ...(caption ? { caption: true } : {}),
          ...(frame ? { frame: { pet_name: frameName } } : {}),
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
    const metaClient = metaClientFromRequest(request);   // null unless marketing cookies were accepted

    // Run generation after the response is sent; after() keeps the function alive until it finishes
    after(() =>
      generateCustomImage({
        customImageId: customImage.id,
        catalogImageUrl,
        designRef: designRef!,
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
        kit,
        slogan,
        words,
        caption,
        frame,
        catalogImageId,
        metaClient,
        requestStarted,
        timings,
      }).then(() => capturePreviews({ ids: [customImage.id] })) // social loop: only if "Include free previews" is on
      // Uploaded photos have no breed: detect it for Admin > Customisations (never throws)
      .then(() => (firstPet?.breed_id ? undefined : detectPetBreed(customImage.id, supabase).then(() => undefined)))
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
