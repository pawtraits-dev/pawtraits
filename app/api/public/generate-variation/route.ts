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

const rateLimiter = new PublicRateLimiter(3, 60); // 3 requests per hour
const geminiService = new GeminiVariationService();
const cloudinaryService = new CloudinaryImageService();

// Force dynamic rendering to avoid build-time errors
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // 1. Extract client IP and check rate limit
    const clientIp = getClientIp(request.headers);
    const endpoint = '/api/public/generate-variation';

    const rateLimitResult = await rateLimiter.checkLimit(clientIp, endpoint);

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
    const { catalogImageId, userImageBase64 } = body;

    if (!catalogImageId || !userImageBase64) {
      return NextResponse.json(
        { error: 'Missing required fields: catalogImageId and userImageBase64' },
        { status: 400 }
      );
    }

    // Validate base64 image data
    if (!userImageBase64.match(/^data:image\/(jpeg|jpg|png);base64,/)) {
      return NextResponse.json(
        { error: 'Invalid image format. Only JPEG and PNG are supported.' },
        { status: 400 }
      );
    }

    // Check image size (rough estimate: base64 is ~1.37x original size)
    const base64Size = userImageBase64.length * 0.75; // Approximate original size
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (base64Size > maxSize) {
      return NextResponse.json(
        { error: 'Image too large. Maximum size is 5MB.' },
        { status: 400 }
      );
    }

    // 3. Fetch catalog image metadata
    const { data: catalogImage, error: catalogError } = await supabaseServiceRole
      .from('image_catalog')
      .select(`
        id,
        cloudinary_public_id,
        prompt_text,
        breed:breeds(id, name, display_name),
        theme:themes(id, name, display_name),
        style:styles(id, name, display_name)
      `)
      .eq('id', catalogImageId)
      .eq('is_public', true)
      .single();

    if (catalogError || !catalogImage) {
      console.error('Catalog image not found:', catalogError);
      return NextResponse.json(
        { error: 'Catalog image not found or not public' },
        { status: 404 }
      );
    }

    // 4. Download catalog image from Cloudinary as base64
    const catalogImageUrl = cloudinaryService.getPublicVariantUrl(
      catalogImage.cloudinary_public_id,
      'full_size'
    );

    const catalogImageResponse = await fetch(catalogImageUrl);
    if (!catalogImageResponse.ok) {
      throw new Error('Failed to download catalog image');
    }

    const catalogImageBuffer = await catalogImageResponse.arrayBuffer();
    const catalogImageBase64 = Buffer.from(catalogImageBuffer).toString('base64');

    // 5. Generate variation using Gemini
    // Create a custom prompt that transforms the catalog style to match the user's dog
    const userImageData = userImageBase64.split(',')[1]; // Remove data:image prefix

    const customPrompt = `Transform the reference image (a pet portrait) to feature the dog shown in the uploaded photo, while maintaining the original artistic style, theme, and composition.

Reference Portrait Style:
- Theme: ${catalogImage.theme?.display_name || 'original theme'}
- Style: ${catalogImage.style?.display_name || 'original style'}
- Breed: ${catalogImage.breed?.display_name || 'original breed'}

Task: Create a new portrait that:
1. Features the EXACT dog from the uploaded photo (preserve their unique appearance, coloring, and markings)
2. Maintains the artistic style, lighting, and mood of the reference portrait
3. Keeps the same composition and framing
4. Preserves the theme elements (background, props, atmosphere)
5. Ensures the result looks professionally composed and cohesive

Important: The dog's appearance from the uploaded photo should be accurately represented, but styled to match the reference portrait's artistic treatment.`;

    console.log(`🎨 Generating variation for IP ${clientIp}`);
    console.log(`📷 Catalog image: ${catalogImage.id}`);
    console.log(`🐕 Breed: ${catalogImage.breed?.name || 'unknown'}`);

    const geminiStartTime = Date.now();

    try {
      const response = await geminiService.ai.models.generateContent({
        model: "gemini-2.5-flash-image-preview",
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
              data: userImageData,
            },
          },
        ],
      });

      const geminiDuration = Date.now() - geminiStartTime;
      console.log(`✅ Gemini generation completed in ${geminiDuration}ms`);

      if (!response.candidates?.[0]?.content?.parts) {
        throw new Error('No image data returned from Gemini');
      }

      const generatedImageData = response.candidates[0].content.parts.find(
        (part: any) => part.inlineData?.data
      )?.inlineData?.data;

      if (!generatedImageData) {
        throw new Error('No image data in Gemini response');
      }

      // 6. Upload to Cloudinary with watermark
      const timestamp = Date.now();
      const filename = `public-generated/${catalogImage.breed?.name || 'dog'}-${timestamp}`;

      const uploadResult = await cloudinaryService.uploadImageBuffer(
        Buffer.from(generatedImageData, 'base64'),
        filename,
        {
          folder: 'pawtraits/public-generated',
          tags: ['public-generation', 'user-created', catalogImage.breed?.name || 'unknown']
        }
      );

      if (!uploadResult) {
        throw new Error('Failed to upload generated image to Cloudinary');
      }

      // 7. Generate watermarked URL
      const watermarkedUrl = cloudinaryService.getPublicVariantUrl(
        uploadResult.publicId,
        'catalog_watermarked'
      );

      // 8. Record successful request for rate limiting
      await rateLimiter.recordRequest(clientIp, endpoint);

      // 9. Return response
      return NextResponse.json({
        success: true,
        watermarkedUrl,
        metadata: {
          breedName: catalogImage.breed?.display_name || 'Unknown',
          themeName: catalogImage.theme?.display_name || 'Unknown',
          styleName: catalogImage.style?.display_name || 'Unknown'
        },
        rateLimitRemaining: rateLimitResult.remaining,
        generationTimeMs: Date.now() - geminiStartTime
      });

    } catch (geminiError: any) {
      console.error('Gemini generation error:', geminiError);

      // Check if it's a rate limit or quota error from Gemini
      if (geminiError.message?.includes('quota') || geminiError.message?.includes('rate')) {
        return NextResponse.json(
          {
            error: 'AI service temporarily unavailable',
            message: 'The AI image generation service is currently at capacity. Please try again in a few minutes.',
            retryAfter: 60
          },
          { status: 503 }
        );
      }

      throw geminiError;
    }

  } catch (error: any) {
    console.error('Public generation API error:', error);
    return NextResponse.json(
      {
        error: 'Generation failed',
        message: 'An error occurred while generating your portrait. Please try again.',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
  }
}
