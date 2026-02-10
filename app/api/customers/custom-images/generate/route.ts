import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { v2 as cloudinary } from 'cloudinary';
import { GeminiVariationService } from '@/lib/gemini-variation-service';
import { VariationPromptBuilder } from '@/lib/variation-prompt-builder';
import fetch from 'node-fetch';
import { CloudinaryImageService } from '@/lib/cloudinary';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const cloudinaryService = new CloudinaryImageService();
const geminiService = new GeminiVariationService();
const promptBuilder = new VariationPromptBuilder();

// Helper function to fetch image and convert to base64
async function imageUrlToBase64(imageUrl: string): Promise<string> {
  const response = await fetch(imageUrl);
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  return buffer.toString('base64');
}

// Helper function to upload base64 image to Cloudinary
async function uploadBase64ToCloudinary(base64Data: string, folder: string): Promise<{ url: string; publicId: string }> {
  const uploadResult = await cloudinary.uploader.upload(
    `data:image/png;base64,${base64Data}`,
    {
      folder: folder,
      resource_type: 'image',
      transformation: [
        { width: 1024, height: 1024, crop: 'limit' },
        { quality: 'auto', fetch_format: 'auto' }
      ]
    }
  );

  return {
    url: uploadResult.secure_url,
    publicId: uploadResult.public_id
  };
}

// Background generation function
async function generateCustomImage(
  customImageId: string,
  catalogImageUrl: string,
  petImageUrl: string,
  variationPromptTemplate: string | undefined,
  themeName: string,
  styleName: string,
  catalogBreedName: string,
  customerPetBreedName?: string
): Promise<void> {
  console.log('🎨 Starting custom image generation for:', customImageId);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  try {
    // Fetch both images and convert to base64
    console.log('📥 Fetching catalog image from:', catalogImageUrl.substring(0, 80) + '...');
    const catalogImageBase64 = await imageUrlToBase64(catalogImageUrl);
    console.log('✅ Catalog image fetched, size:', catalogImageBase64.length, 'bytes');

    console.log('📥 Fetching pet image from:', petImageUrl.substring(0, 80) + '...');
    const petImageBase64 = await imageUrlToBase64(petImageUrl);
    console.log('✅ Pet image fetched, size:', petImageBase64.length, 'bytes');

    // Build prompt using shared service (same as admin)
    console.log('🤖 Building prompt with variation template...');
    const generationPrompt = promptBuilder.buildSubjectReplacementPrompt({
      compositionTemplate: variationPromptTemplate,
      metadata: {
        breedName: customerPetBreedName || catalogBreedName,
        themeName: themeName,
        styleName: styleName,
        formatName: 'portrait'
      }
    });

    console.log('📝 Using variation prompt template:', !!variationPromptTemplate);
    console.log('🤖 Calling Gemini API with model: gemini-3-pro-image-preview');
    const startTime = Date.now();

    // Prepare image data (remove data URL prefixes if present)
    const catalogImageData = catalogImageBase64.startsWith('data:')
      ? catalogImageBase64.split(',')[1]
      : catalogImageBase64;
    const petImageData = petImageBase64.startsWith('data:')
      ? petImageBase64.split(',')[1]
      : petImageBase64;

    // Call Gemini via service (same model as admin)
    const response = await geminiService.ai.models.generateContent({
      model: "gemini-3-pro-image-preview",
      contents: [
        { text: generationPrompt },
        {
          inlineData: {
            mimeType: "image/png",
            data: catalogImageData,
          },
        },
        {
          inlineData: {
            mimeType: "image/png",
            data: petImageData,
          },
        },
      ],
    });

    const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`✅ Gemini API call completed in ${elapsedSeconds}s`);

    if (!response.candidates?.[0]?.content?.parts) {
      throw new Error('No image generated from Gemini');
    }

    // Extract generated image
    let generatedImageBase64: string | null = null;
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData?.data) {
        generatedImageBase64 = part.inlineData.data;
        break;
      }
    }

    if (!generatedImageBase64) {
      throw new Error('No image data in Gemini response');
    }

    console.log('✅ Image generated, uploading to Cloudinary...');

    // Upload to Cloudinary
    const { url: generatedImageUrl, publicId: generatedCloudinaryId } = await uploadBase64ToCloudinary(
      generatedImageBase64,
      'customer-custom-images'
    );

    console.log('✅ Uploaded to Cloudinary:', generatedCloudinaryId);

    // Update database record
    await supabase
      .from('customer_custom_images')
      .update({
        generated_image_url: generatedImageUrl,
        generated_cloudinary_id: generatedCloudinaryId,
        generation_prompt: generationPrompt,
        status: 'complete',
        generated_at: new Date().toISOString(),
        generation_metadata: {
          catalog_image_url: catalogImageUrl,
          pet_image_url: petImageUrl,
          theme: themeName,
          style: styleName,
          model: 'gemini-3-pro-image-preview'
        }
      })
      .eq('id', customImageId);

    console.log('✅ Custom image generation complete:', customImageId);

  } catch (error) {
    console.error('❌ Error in generateCustomImage:', error);
    throw error;
  }
}

export async function POST(request: NextRequest) {
  console.log('🎨 [CUSTOM IMAGE GENERATE] Request received at /api/customers/custom-images/generate');
  console.log('🎨 [CUSTOM IMAGE GENERATE] Request method:', request.method);
  console.log('🎨 [CUSTOM IMAGE GENERATE] Request headers:', {
    contentType: request.headers.get('content-type'),
    contentLength: request.headers.get('content-length')
  });

  try {
    // Authenticate user using cookie-based auth
    const cookieStore = await cookies();
    const supabaseAuth = createRouteHandlerClient({ cookies: () => cookieStore });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    console.log('🎨 Custom image generation: Authenticated user:', user.email);

    // Use service role client for database operations
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Parse FormData
    const formData = await request.formData();
    const catalogImageId = formData.get('catalogImageId') as string;
    const petId = formData.get('petId') as string | null;
    const petPhoto = formData.get('petPhoto') as File | null;

    console.log('📦 FormData received:', {
      catalogImageId,
      petId,
      hasPetPhoto: !!petPhoto,
      petPhotoSize: petPhoto?.size
    });

    if (!catalogImageId) {
      return NextResponse.json(
        { error: 'Catalog image ID is required' },
        { status: 400 }
      );
    }

    if (!petId && !petPhoto) {
      return NextResponse.json(
        { error: 'Either pet ID or pet photo is required' },
        { status: 400 }
      );
    }

    // Get customer record
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id, email')
      .eq('email', user.email)
      .single();

    if (customerError || !customer) {
      return NextResponse.json(
        { error: 'Customer profile not found' },
        { status: 404 }
      );
    }

    // Get catalog image details
    console.log('🖼️ Fetching catalog image:', catalogImageId);
    const { data: catalogImage, error: catalogError } = await supabase
      .from('image_catalog')
      .select(`
        id,
        cloudinary_public_id,
        public_url,
        theme_id,
        style_id,
        breed_id,
        prompt_text,
        generation_parameters,
        breeds (id, name),
        themes (id, name),
        styles (id, name)
      `)
      .eq('id', catalogImageId)
      .single();

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
      hasGenerationParams: !!catalogImage.generation_parameters
    });

    // Extract variation prompt template from Claude analysis
    const variationPromptTemplate = catalogImage.generation_parameters?.variation_prompt_template;
    if (!variationPromptTemplate) {
      console.warn('⚠️ No variation_prompt_template found in catalog image. Using fallback prompt.');
    }

    // Generate Cloudinary URL if we have the public_id
    let catalogImageUrl = catalogImage.public_url;
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

    let petData: any = null;
    let petImageUrl: string = '';
    let petCloudinaryId: string = '';

    if (petId) {
      // Use existing pet
      console.log('🐕 Fetching pet data for petId:', petId, 'userId:', user.id);
      const { data: pet, error: petError } = await supabase
        .from('pets')
        .select(`
          id,
          name,
          breed_id,
          coat_id,
          primary_photo_url,
          breeds (id, name),
          coats (id, name, description)
        `)
        .eq('id', petId)
        .eq('user_id', user.id)
        .single();

      if (petError || !pet) {
        console.error('❌ Pet lookup failed:', { petError, hasPet: !!pet, petId, userId: user.id });
        return NextResponse.json(
          { error: 'Pet not found', details: petError?.message || 'Pet does not exist or does not belong to user' },
          { status: 404 }
        );
      }

      console.log('✅ Pet found:', { petId: pet.id, petName: pet.name, hasPhotoUrl: !!pet.primary_photo_url });
      petData = pet;
      petImageUrl = pet.primary_photo_url;

      // Extract Cloudinary ID from URL if it's a Cloudinary URL
      if (petImageUrl.includes('cloudinary.com')) {
        const urlParts = petImageUrl.split('/');
        const uploadIndex = urlParts.indexOf('upload');
        if (uploadIndex !== -1 && uploadIndex + 2 < urlParts.length) {
          petCloudinaryId = urlParts.slice(uploadIndex + 2).join('/').split('.')[0];
        } else {
          petCloudinaryId = 'unknown';
        }
      } else {
        petCloudinaryId = 'non-cloudinary';
      }
      console.log('🔗 Pet image URL processed:', { petImageUrl: petImageUrl.substring(0, 50) + '...', petCloudinaryId });
    } else if (petPhoto) {
      // Upload new pet photo
      console.log('📤 Uploading pet photo to Cloudinary...');

      const arrayBuffer = await petPhoto.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Upload to Cloudinary
      const uploadResult = await new Promise<any>((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: 'customer-custom-pets',
            resource_type: 'image',
            transformation: [
              { width: 1024, height: 1024, crop: 'limit' },
              { quality: 'auto', fetch_format: 'auto' }
            ]
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        uploadStream.end(buffer);
      });

      petImageUrl = uploadResult.secure_url;
      petCloudinaryId = uploadResult.public_id;

      console.log('✅ Pet photo uploaded:', petCloudinaryId);

      // For uploaded photos, we don't have breed/coat info yet
      // TODO: Add AI analysis to detect breed/coat from uploaded photo
    }

    // Validate that we have pet image data before proceeding
    if (!petImageUrl || !petCloudinaryId) {
      console.error('❌ Missing pet image data:', { petImageUrl, petCloudinaryId });
      return NextResponse.json(
        { error: 'Failed to process pet image' },
        { status: 400 }
      );
    }

    console.log('✅ Pet image data validated:', {
      hasUrl: !!petImageUrl,
      hasCloudinaryId: !!petCloudinaryId,
      petName: petData?.name || 'Uploaded Pet'
    });

    // Create custom image record in database
    const { data: customImage, error: insertError } = await supabase
      .from('customer_custom_images')
      .insert({
        customer_id: customer.id,
        customer_email: customer.email,
        catalog_image_id: catalogImageId,
        pet_id: petId || null,
        pet_name: petData?.name || 'Uploaded Pet',
        pet_breed_id: petData?.breed_id || null,
        pet_coat_id: petData?.coat_id || null,
        pet_image_url: petImageUrl,
        pet_cloudinary_id: petCloudinaryId,
        status: 'pending',
        is_public: true, // Make shareable by default
        metadata: {
          catalog_theme: catalogImage.themes?.name,
          catalog_style: catalogImage.styles?.name,
          catalog_breed: catalogImage.breeds?.name,
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

    // Update status to generating
    await supabase
      .from('customer_custom_images')
      .update({ status: 'generating' })
      .eq('id', customImage.id);

    // Start generation process in background (don't await)
    generateCustomImage(
      customImage.id,
      catalogImageUrl,
      petImageUrl,
      variationPromptTemplate,
      catalogImage.themes?.name || 'Custom',
      catalogImage.styles?.name || 'Portrait',
      catalogImage.breeds?.name || 'Pet',
      petData?.breeds?.name
    ).catch(async (error) => {
      console.error('❌ Error in background generation:', error);
      // Update record with error status
      await supabase
        .from('customer_custom_images')
        .update({
          status: 'failed',
          error_message: error instanceof Error ? error.message : 'Generation failed'
        })
        .eq('id', customImage.id);
    });

    return NextResponse.json({
      ...customImage,
      status: 'generating'
    });

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
