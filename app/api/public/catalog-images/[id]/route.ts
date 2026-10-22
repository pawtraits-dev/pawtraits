import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { CloudinaryImageService } from '@/lib/cloudinary';
import { loadSlots, subjectsOf } from '@/lib/catalog/slots-server';
import { readKit } from '@/lib/collections/kit-lettering';
import { designMotto } from '@/lib/collections/slogan-server';
import { wrapMockups } from '@/lib/mugs/mockup';
import { sloganLayer } from '@/lib/collections/slogan';
import { readWords, wordsLayer, WORDS_TOKEN } from '@/lib/picture-words';
import { breedPhrase } from '@/lib/picture-words-server';

// Use service role client to bypass RLS for public catalog data
const supabaseServiceRole = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const cloudinaryService = new CloudinaryImageService();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    console.log('📸 [CATALOG API] Request received for ID:', id);

    if (!id) {
      console.log('❌ [CATALOG API] No ID provided');
      return NextResponse.json(
        { error: 'Catalog image ID is required' },
        { status: 400 }
      );
    }

    console.log('🔍 [CATALOG API] Fetching from database...');
    // Fetch catalog image with related metadata
    const { data: catalogImage, error } = await supabaseServiceRole
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

      if (error.code === 'PGRST116') {
        console.log('❌ [CATALOG API] Image not found or not public');
        return NextResponse.json(
          { error: 'Catalog image not found or not public' },
          { status: 404 }
        );
      }

      throw error;
    }

    console.log('✅ [CATALOG API] Found catalog image:', {
      id: catalogImage.id,
      cloudinaryPublicId: catalogImage.cloudinary_public_id,
      breedName: catalogImage.breed?.name,
      isPublic: true
    });

    // Generate Cloudinary URLs for different variants
    console.log('🖼️ [CATALOG API] Generating Cloudinary URLs...');
    const imageUrl = catalogImage.cloudinary_public_id
      ? cloudinaryService.getPublicVariantUrl(catalogImage.cloudinary_public_id, 'full_size')
      : null;

    const thumbnailUrl = catalogImage.cloudinary_public_id
      ? cloudinaryService.getPublicVariantUrl(catalogImage.cloudinary_public_id, 'thumbnail')
      : null;

    console.log('🔗 [CATALOG API] Generated URLs:', {
      imageUrl: imageUrl?.substring(0, 100) + '...',
      thumbnailUrl: thumbnailUrl?.substring(0, 100) + '...',
      hasCloudinaryId: !!catalogImage.cloudinary_public_id
    });

    // How many pets: image_catalog.subjects (kept in step with generation_parameters by a trigger,
    // multi-pet plan phase 1), else generation_parameters for anything older
    const subjectCount = Math.max(1,
      Array.isArray(catalogImage.subjects) ? catalogImage.subjects.length : 0,
      Array.isArray(catalogImage.generation_parameters?.subjects) ? catalogImage.generation_parameters.subjects.length : 0);
    const isMultiSubject = subjectCount > 1;
    // Who goes where (multi-pet plan phase 2): one slot per pet, left to right, photo N → slot N
    const slots = isMultiSubject ? await loadSlots(supabaseServiceRole, subjectsOf(catalogImage)) : [];

    // Personalised football kit: the customer chooses the name and number on the shirt (one-pet
    // designs only). Separate read so the page still works before the 2026-10-20 migration.
    const { data: kitRow } = await supabaseServiceRole.from('image_catalog').select('kit_personalisation').eq('id', catalogImage.id).maybeSingle();
    const kit = !isMultiSubject ? readKit((kitRow as any)?.kit_personalisation) : null;
    // Team motto as big text on the right (designs with "Show the team motto" ticked)
    const motto = kit?.slogan ? await designMotto(supabaseServiceRole as any, catalogImage.id).catch(() => null) : null;
    const displayUrl = motto && catalogImage.cloudinary_public_id
      ? cloudinaryService.getPublicVariantUrl(catalogImage.cloudinary_public_id, 'full_size', { overlay: sloganLayer(motto) })
      : imageUrl;

    // Words on the picture ("Please be seated, {pet} will see you shortly"): the customer chooses
    // their pet's name or breed; the page previews it live from this URL template (one-pet designs)
    const { data: wordsRow } = await supabaseServiceRole.from('image_catalog').select('text_overlay').eq('id', catalogImage.id).maybeSingle();
    const pictureWords = !isMultiSubject ? readWords((wordsRow as any)?.text_overlay) : null;
    const words = pictureWords?.clean_public_id ? {
      template: pictureWords.template,
      phrase: await breedPhrase(supabaseServiceRole as any, catalogImage.breed_id),
      previewUrl: cloudinaryService.getPublicVariantUrl(pictureWords.clean_public_id, 'catalog_watermarked', { overlay: wordsLayer(pictureWords, WORDS_TOKEN), format: 'jpg' }),
      token: WORDS_TOKEN,
    } : null;

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

    console.log('✅ [CATALOG API] Returning response with breed:', response.breed?.displayName);
    return NextResponse.json(response);
  } catch (error: any) {
    console.error('❌ [CATALOG API] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch catalog image', details: error.message },
      { status: 500 }
    );
  }
}
