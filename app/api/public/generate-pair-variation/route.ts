import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { PublicRateLimiter, getClientIp } from '@/lib/public-rate-limiter';
import { GeminiVariationService } from '@/lib/gemini-variation-service';
import { CloudinaryImageService } from '@/lib/cloudinary';

// Use service role client to bypass RLS
const supabaseServiceRole = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const rateLimiter = new PublicRateLimiter(); // Configured via environment variables
const geminiService = new GeminiVariationService();
const cloudinaryService = new CloudinaryImageService();

// Force dynamic rendering
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    console.log('🎨 [PAIR GENERATE API] Request received');
    console.log('🔑 [PAIR GENERATE API] Environment check:', {
      hasGeminiKey: !!process.env.GEMINI_API_KEY,
      hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasServiceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      hasCloudinaryConfig: !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY)
    });

    // 1. Extract client IP and check rate limit
    const clientIp = getClientIp(request.headers);
    const endpoint = '/api/public/generate-pair-variation';

    console.log('🔒 [PAIR GENERATE API] Checking rate limit for IP:', clientIp);
    const rateLimitResult = await rateLimiter.checkLimit(clientIp, endpoint);
    console.log('🔒 [PAIR GENERATE API] Rate limit result:', rateLimitResult);

    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          message: `You have reached the maximum of 3 generations per hour. Please try again in ${rateLimitResult.retryAfter} seconds.`,
          retryAfter: rateLimitResult.retryAfter,
          resetAt: rateLimitResult.resetAt
        },
        { status: 429 }
      );
    }

    // 2. Validate request body
    const body = await request.json();
    const { catalogImageId, pet1ImageBase64, pet2ImageBase64 } = body;

    console.log('📦 [PAIR GENERATE API] Request data:', {
      catalogImageId,
      hasPet1Image: !!pet1ImageBase64,
      hasPet2Image: !!pet2ImageBase64,
      pet1ImageSize: pet1ImageBase64?.length,
      pet2ImageSize: pet2ImageBase64?.length
    });

    if (!catalogImageId || !pet1ImageBase64 || !pet2ImageBase64) {
      console.log('❌ [PAIR GENERATE API] Missing required fields');
      return NextResponse.json(
        { error: 'Missing required fields: catalogImageId, pet1ImageBase64, and pet2ImageBase64' },
        { status: 400 }
      );
    }

    // Validate base64 image data for both pets
    if (!pet1ImageBase64.match(/^data:image\/(jpeg|jpg|png);base64,/) ||
        !pet2ImageBase64.match(/^data:image\/(jpeg|jpg|png);base64,/)) {
      return NextResponse.json(
        { error: 'Invalid image format. Only JPEG and PNG are supported.' },
        { status: 400 }
      );
    }

    // Check image sizes
    const maxSize = 5 * 1024 * 1024; // 5MB
    const pet1Size = pet1ImageBase64.length * 0.75;
    const pet2Size = pet2ImageBase64.length * 0.75;

    if (pet1Size > maxSize || pet2Size > maxSize) {
      return NextResponse.json(
        { error: 'One or both images too large. Maximum size is 5MB each.' },
        { status: 400 }
      );
    }

    // 3. Fetch catalog image metadata
    console.log('🔍 [PAIR GENERATE API] Fetching catalog image metadata...');
    const { data: catalogImage, error: catalogError } = await supabaseServiceRole
      .from('image_catalog')
      .select(`
        id,
        cloudinary_public_id,
        prompt_text,
        breed:breeds(id, name),
        theme:themes(id, name),
        style:styles(id, name)
      `)
      .eq('id', catalogImageId)
      .eq('is_public', true)
      .single();

    if (catalogError || !catalogImage) {
      console.error('❌ [PAIR GENERATE API] Catalog image not found:', catalogError);
      return NextResponse.json(
        { error: 'Catalog image not found or not public' },
        { status: 404 }
      );
    }

    console.log('✅ [PAIR GENERATE API] Catalog image found:', {
      id: catalogImage.id,
      cloudinaryId: catalogImage.cloudinary_public_id,
      breed: catalogImage.breed?.name
    });

    // 4. Download catalog image from Cloudinary as base64
    console.log('📥 [PAIR GENERATE API] Downloading catalog image from Cloudinary...');
    const catalogImageUrl = cloudinaryService.getPublicVariantUrl(
      catalogImage.cloudinary_public_id,
      'full_size'
    );
    console.log('🔗 [PAIR GENERATE API] Catalog image URL:', catalogImageUrl.substring(0, 100));

    const catalogImageResponse = await fetch(catalogImageUrl);
    console.log('📥 [PAIR GENERATE API] Cloudinary fetch status:', catalogImageResponse.status);

    if (!catalogImageResponse.ok) {
      console.error('❌ [PAIR GENERATE API] Failed to download catalog image:', catalogImageResponse.status);
      throw new Error('Failed to download catalog image');
    }

    const catalogImageBuffer = await catalogImageResponse.arrayBuffer();
    const catalogImageBase64 = Buffer.from(catalogImageBuffer).toString('base64');
    console.log('✅ [PAIR GENERATE API] Catalog image downloaded, size:', catalogImageBase64.length);

    // 5. Generate variation using Gemini with TWO pet images
    const pet1ImageData = pet1ImageBase64.split(',')[1]; // Remove data:image prefix
    const pet2ImageData = pet2ImageBase64.split(',')[1]; // Remove data:image prefix

    const customPrompt = `CRITICAL INSTRUCTION: MODIFY THE REFERENCE IMAGE, DO NOT CREATE A NEW IMAGE

You are given a reference portrait image showing TWO subjects. Your task is to MODIFY this EXACT image by REPLACING ONLY the two subjects with the subjects from the two uploaded photos.

PRESERVATION REQUIREMENTS (THESE MUST REMAIN IDENTICAL):
- The EXACT background from the reference image
- The EXACT composition, framing, and camera angle
- The EXACT lighting setup, shadows, and highlights
- The EXACT props, objects, and scenic elements
- The EXACT color palette and mood
- The EXACT artistic style, brushwork, and texture
- The EXACT positions and poses of the two subjects (same locations in frame, same relative positioning)

REPLACEMENT REQUIREMENTS (ONLY THIS CHANGES):
- Replace the two original subjects with the subjects from the two uploaded photos
- First uploaded photo → replaces first subject position
- Second uploaded photo → replaces second subject position
- Each new subject must have the EXACT physical appearance from their uploaded photo (coloring, markings, facial features, fur/hair patterns, distinctive characteristics)
- ANALYZE the apparent size of each uploaded subject and maintain REALISTIC RELATIVE PROPORTIONS (if one appears significantly smaller, make them smaller; if they appear similar in size, make them similar)
- Both subjects must be rendered in the SAME artistic medium as the reference (if reference is oil painting, paint both subjects in oil paint style; if watercolor, render as watercolor, etc.)
- Both subjects must match the lighting and style of the reference portrait
- DO NOT make subjects photorealistic - they must match the artistic style of the reference

Reference Portrait Metadata:
- Theme: ${catalogImage.theme?.name || 'original theme'}
- Style: ${catalogImage.style?.name || 'original style'}
- Original Subjects: ${catalogImage.breed?.name || 'original subjects'}

CRITICAL VERIFICATION:
- If someone compared your output to the reference image, the ONLY differences should be:
  1. The appearance of the two subjects (now showing the uploaded photos' subjects)
  2. The relative sizes of the subjects (if the uploaded subjects are different sizes)
- Everything else (background, composition, lighting, style, props, positioning) must be IDENTICAL to the reference
- DO NOT invent new backgrounds, change the scene, or alter the composition
- This is a subject replacement task, NOT a new image generation task`;

    console.log('🤖 [PAIR GENERATE API] Starting Gemini generation with TWO pets...');
    console.log(`🎨 [PAIR GENERATE API] IP: ${clientIp}`);
    console.log(`📷 [PAIR GENERATE API] Catalog: ${catalogImage.id}`);
    console.log(`🐕 [PAIR GENERATE API] Breed: ${catalogImage.breed?.name || 'unknown'}`);

    const geminiStartTime = Date.now();

    try {
      const response = await geminiService.ai.models.generateContent({
        model: "gemini-3-pro-image-preview",
        contents: [
          { text: customPrompt },
          {
            inlineData: {
              mimeType: "image/png",
              data: catalogImageBase64,
            },
          },
          {
            inlineData: {
              mimeType: "image/png",
              data: pet1ImageData,
            },
          },
          {
            inlineData: {
              mimeType: "image/png",
              data: pet2ImageData,
            },
          },
        ],
      });

      const geminiDuration = Date.now() - geminiStartTime;
      console.log(`✅ [PAIR GENERATE API] Gemini completed in ${geminiDuration}ms`);

      if (!response.candidates?.[0]?.content?.parts) {
        console.error('❌ [PAIR GENERATE API] No candidates in response');
        throw new Error('No image data returned from Gemini');
      }

      const generatedImageData = response.candidates[0].content.parts.find(
        (part: any) => part.inlineData?.data
      )?.inlineData?.data;

      if (!generatedImageData) {
        console.error('❌ [PAIR GENERATE API] No image data in parts');
        throw new Error('No image data in Gemini response');
      }

      console.log('✅ [PAIR GENERATE API] Image generated, size:', generatedImageData.length);

      // 6. Upload to Cloudinary with watermark
      console.log('📤 [PAIR GENERATE API] Uploading to Cloudinary...');
      const timestamp = Date.now();
      const filename = `public-pair-${catalogImage.breed?.name || 'pets'}-${timestamp}.png`;

      const uploadResult = await cloudinaryService.uploadAndProcessImage(
        Buffer.from(generatedImageData, 'base64'),
        filename,
        {
          breed: catalogImage.breed?.name || 'pets',
          theme: catalogImage.theme?.name || 'custom',
          style: catalogImage.style?.name || 'portrait',
          format: 'square'
        }
      );

      if (!uploadResult) {
        console.error('❌ [PAIR GENERATE API] Cloudinary upload failed');
        throw new Error('Failed to upload generated image to Cloudinary');
      }

      console.log('✅ [PAIR GENERATE API] Uploaded to Cloudinary:', uploadResult.public_id);

      // 7. Generate watermarked URL
      const watermarkedUrl = cloudinaryService.getPublicVariantUrl(
        uploadResult.public_id,
        'catalog_watermarked'
      );
      console.log('🔗 [PAIR GENERATE API] Watermarked URL:', watermarkedUrl.substring(0, 100));

      // 8. Record successful request for rate limiting
      await rateLimiter.recordRequest(clientIp, endpoint);

      // 9. Return response
      console.log('✅ [PAIR GENERATE API] Success! Returning response');
      return NextResponse.json({
        success: true,
        watermarkedUrl,
        metadata: {
          breedName: catalogImage.breed?.name || 'Unknown',
          themeName: catalogImage.theme?.name || 'Unknown',
          styleName: catalogImage.style?.name || 'Unknown'
        },
        rateLimitRemaining: rateLimitResult.remaining,
        generationTimeMs: Date.now() - geminiStartTime
      });

    } catch (geminiError: any) {
      console.error('❌ [PAIR GENERATE API] Gemini generation error:', {
        message: geminiError.message,
        stack: geminiError.stack,
        name: geminiError.name,
        fullError: geminiError
      });

      // Check if it's a rate limit or quota error from Gemini
      if (geminiError.message?.includes('quota') || geminiError.message?.includes('rate')) {
        console.log('⚠️ [PAIR GENERATE API] Detected quota/rate limit error');
        return NextResponse.json(
          {
            error: 'AI service temporarily unavailable',
            message: 'The AI image generation service is currently at capacity. Please try again in a few minutes.',
            retryAfter: 60,
            details: process.env.NODE_ENV === 'development' ? geminiError.message : undefined
          },
          { status: 503 }
        );
      }

      console.error('❌ [PAIR GENERATE API] Unexpected Gemini error, re-throwing');
      throw geminiError;
    }

  } catch (error: any) {
    console.error('❌ [PAIR GENERATE API] Unexpected error:', error);
    return NextResponse.json(
      {
        error: 'Generation failed',
        message: 'An error occurred while generating your pair portrait. Please try again.',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
  }
}
