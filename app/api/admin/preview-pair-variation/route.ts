import { NextRequest, NextResponse } from 'next/server';
import { GeminiVariationService } from '@/lib/gemini-variation-service';
import { CloudinaryImageService } from '@/lib/cloudinary';

const geminiService = new GeminiVariationService();
const cloudinaryService = new CloudinaryImageService();

// Force dynamic rendering
export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/preview-pair-variation
 *
 * Admin-only endpoint to test customer pair pet photo replacement before saving to catalog
 * NO rate limiting, NO database dependency - uses unsaved reference data directly
 * Handles 2+ subjects (pair portraits)
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🎨 [ADMIN PAIR PREVIEW API] Request received');

    // Parse request body
    const body = await request.json();
    const { referenceImageBase64, pet1ImageBase64, pet2ImageBase64, compositionPromptTemplate, metadata } = body;

    console.log('📦 [ADMIN PAIR PREVIEW API] Request data:', {
      hasReferenceImage: !!referenceImageBase64,
      hasPet1Image: !!pet1ImageBase64,
      hasPet2Image: !!pet2ImageBase64,
      hasPromptTemplate: !!compositionPromptTemplate,
      metadata
    });

    // 1. Validate required fields
    if (!referenceImageBase64 || !pet1ImageBase64 || !pet2ImageBase64) {
      console.log('❌ [ADMIN PAIR PREVIEW API] Missing required images');
      return NextResponse.json(
        { error: 'Missing required fields: referenceImageBase64, pet1ImageBase64, and pet2ImageBase64' },
        { status: 400 }
      );
    }

    // 2. Validate base64 image formats
    const referenceValid = referenceImageBase64.match(/^data:image\/(jpeg|jpg|png|webp);base64,/);
    const pet1Valid = pet1ImageBase64.match(/^data:image\/(jpeg|jpg|png|webp);base64,/);
    const pet2Valid = pet2ImageBase64.match(/^data:image\/(jpeg|jpg|png|webp);base64,/);

    if (!referenceValid || !pet1Valid || !pet2Valid) {
      return NextResponse.json(
        { error: 'Invalid image format. Only JPEG, PNG, and WEBP are supported.' },
        { status: 400 }
      );
    }

    // 3. Build subject replacement prompt for pair
    const customPrompt = buildPairSubjectReplacementPrompt(compositionPromptTemplate, metadata);
    console.log('📝 [ADMIN PAIR PREVIEW API] Prompt length:', customPrompt.length, 'characters');

    // 4. Prepare image data for Gemini (remove data URL prefixes)
    const referenceImageData = referenceImageBase64.split(',')[1];
    const pet1ImageData = pet1ImageBase64.split(',')[1];
    const pet2ImageData = pet2ImageBase64.split(',')[1];

    // 5. Call Gemini API for subject replacement with TWO pets
    console.log('🤖 [ADMIN PAIR PREVIEW API] Starting Gemini generation...');
    console.log(`🎨 [ADMIN PAIR PREVIEW API] Metadata: ${JSON.stringify(metadata)}`);

    const geminiStartTime = Date.now();

    try {
      const response = await geminiService.ai.models.generateContent({
        model: "gemini-3-pro-image-preview",
        contents: [
          { text: customPrompt },
          {
            inlineData: {
              mimeType: "image/png",
              data: referenceImageData,
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
      console.log(`✅ [ADMIN PAIR PREVIEW API] Gemini completed in ${geminiDuration}ms`);

      // 6. Extract generated image data
      if (!response.candidates?.[0]?.content?.parts) {
        console.error('❌ [ADMIN PAIR PREVIEW API] No candidates in response');
        throw new Error('No image data returned from Gemini');
      }

      const generatedImageData = response.candidates[0].content.parts.find(
        (part: any) => part.inlineData?.data
      )?.inlineData?.data;

      if (!generatedImageData) {
        console.error('❌ [ADMIN PAIR PREVIEW API] No image data in parts');
        throw new Error('No image data in Gemini response');
      }

      console.log('✅ [ADMIN PAIR PREVIEW API] Image generated, size:', generatedImageData.length);

      // 7. Upload to Cloudinary with admin_preview tag
      console.log('📤 [ADMIN PAIR PREVIEW API] Uploading to Cloudinary...');
      const timestamp = Date.now();
      const filename = `admin-pair-preview-${timestamp}.png`;

      const uploadResult = await cloudinaryService.uploadAndProcessImage(
        Buffer.from(generatedImageData, 'base64'),
        filename,
        {
          breed: 'pair',
          theme: metadata.themeName || 'test',
          style: metadata.styleName || 'preview',
          format: metadata.formatName || 'square',
          tags: ['admin_preview', 'test_variation', 'pair'] // Special tags for cleanup
        }
      );

      if (!uploadResult) {
        console.error('❌ [ADMIN PAIR PREVIEW API] Cloudinary upload failed');
        throw new Error('Failed to upload generated image to Cloudinary');
      }

      console.log('✅ [ADMIN PAIR PREVIEW API] Uploaded to Cloudinary:', uploadResult.public_id);

      // 8. Generate watermarked and full-size URLs
      const watermarkedUrl = cloudinaryService.getPublicVariantUrl(
        uploadResult.public_id,
        'catalog_watermarked'
      );

      const fullSizeUrl = cloudinaryService.getPublicVariantUrl(
        uploadResult.public_id,
        'full_size'
      );

      console.log('🔗 [ADMIN PAIR PREVIEW API] Watermarked URL:', watermarkedUrl.substring(0, 100));

      // 9. Return response with metadata for admin debugging
      console.log('✅ [ADMIN PAIR PREVIEW API] Success! Returning response');
      return NextResponse.json({
        success: true,
        watermarkedUrl,
        fullSizeUrl, // Admin can download full quality
        metadata: {
          generationTimeMs: geminiDuration,
          geminiModel: 'gemini-3-pro-image-preview',
          promptUsed: customPrompt, // Admin can see exact prompt
          cloudinaryPublicId: uploadResult.public_id,
          subjectCount: 2,
          ...metadata
        }
      });

    } catch (geminiError: any) {
      console.error('❌ [ADMIN PAIR PREVIEW API] Gemini generation error:', {
        message: geminiError.message,
        stack: geminiError.stack,
        name: geminiError.name
      });

      // Provide detailed error info for admin debugging
      return NextResponse.json(
        {
          error: 'Gemini generation failed',
          message: geminiError.message || 'AI generation service error',
          details: {
            geminiModel: 'gemini-3-pro-image-preview',
            errorType: geminiError.name,
            errorMessage: geminiError.message,
            duration: Date.now() - geminiStartTime
          }
        },
        { status: 500 }
      );
    }

  } catch (error: any) {
    console.error('❌ [ADMIN PAIR PREVIEW API] Unexpected error:', error);
    return NextResponse.json(
      {
        error: 'Preview generation failed',
        message: 'An error occurred while generating the pair preview variation.',
        details: error.message
      },
      { status: 500 }
    );
  }
}

/**
 * Build pair subject replacement prompt for Gemini
 * Based on public pair endpoint prompt structure with composition template integration
 */
function buildPairSubjectReplacementPrompt(
  compositionTemplate?: string,
  metadata?: {
    breedName?: string;
    themeName?: string;
    styleName?: string;
    formatName?: string;
  }
): string {
  const preservationRequirements = compositionTemplate || `- The EXACT background from the reference image
- The EXACT composition, framing, and camera angle
- The EXACT lighting setup, shadows, and highlights
- The EXACT props, objects, and scenic elements
- The EXACT color palette and mood
- The EXACT artistic style, brushwork, and texture
- The EXACT positions and poses of the two subjects (same locations in frame, same relative positioning)`;

  return `CRITICAL INSTRUCTION: MODIFY THE REFERENCE IMAGE, DO NOT CREATE A NEW IMAGE

You are given a reference portrait image showing TWO subjects. Your task is to MODIFY this EXACT image by REPLACING ONLY the two subjects with the subjects from the two uploaded photos.

PRESERVATION REQUIREMENTS (THESE MUST REMAIN IDENTICAL):
${preservationRequirements}

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
- Theme: ${metadata?.themeName || 'original theme'}
- Style: ${metadata?.styleName || 'original style'}
- Format: ${metadata?.formatName || 'original format'}

CRITICAL VERIFICATION:
- If someone compared your output to the reference image, the ONLY differences should be:
  1. The appearance of the two subjects (now showing the uploaded photos' subjects)
  2. The relative sizes of the subjects (if the uploaded subjects are different sizes)
- Everything else (background, composition, lighting, style, props, positioning) must be IDENTICAL to the reference
- DO NOT invent new backgrounds, change the scene, or alter the composition
- This is a subject replacement task, NOT a new image generation task`;
}
