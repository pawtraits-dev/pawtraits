import { NextRequest, NextResponse } from 'next/server';
import { GeminiVariationService } from '@/lib/gemini-variation-service';
import { CloudinaryImageService } from '@/lib/cloudinary';

const geminiService = new GeminiVariationService();
const cloudinaryService = new CloudinaryImageService();

// Force dynamic rendering
export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/preview-variation
 *
 * Admin-only endpoint to test customer pet photo replacement before saving to catalog
 * NO rate limiting, NO database dependency - uses unsaved reference data directly
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🎨 [ADMIN PREVIEW API] Request received');

    // Parse request body
    const body = await request.json();
    const { referenceImageBase64, petImageBase64, compositionPromptTemplate, metadata } = body;

    console.log('📦 [ADMIN PREVIEW API] Request data:', {
      hasReferenceImage: !!referenceImageBase64,
      hasPetImage: !!petImageBase64,
      hasPromptTemplate: !!compositionPromptTemplate,
      metadata
    });

    // 1. Validate required fields
    if (!referenceImageBase64 || !petImageBase64) {
      console.log('❌ [ADMIN PREVIEW API] Missing required images');
      return NextResponse.json(
        { error: 'Missing required fields: referenceImageBase64 and petImageBase64' },
        { status: 400 }
      );
    }

    // 2. Validate base64 image formats
    const referenceValid = referenceImageBase64.match(/^data:image\/(jpeg|jpg|png|webp);base64,/);
    const petValid = petImageBase64.match(/^data:image\/(jpeg|jpg|png|webp);base64,/);

    if (!referenceValid || !petValid) {
      return NextResponse.json(
        { error: 'Invalid image format. Only JPEG, PNG, and WEBP are supported.' },
        { status: 400 }
      );
    }

    // 3. Check image sizes (rough estimate: base64 is ~1.37x original size)
    const maxSize = 10 * 1024 * 1024; // 10MB for admin (more lenient)
    const refSize = referenceImageBase64.length * 0.75;
    const petSize = petImageBase64.length * 0.75;

    console.log('📏 [ADMIN PREVIEW API] Image sizes:', {
      referenceMB: (refSize / 1024 / 1024).toFixed(2),
      petMB: (petSize / 1024 / 1024).toFixed(2)
    });

    if (refSize > maxSize || petSize > maxSize) {
      return NextResponse.json(
        { error: 'One or both images too large. Maximum size is 10MB each.' },
        { status: 400 }
      );
    }

    // 4. Build subject replacement prompt
    const customPrompt = buildSubjectReplacementPrompt(compositionPromptTemplate, metadata);
    console.log('📝 [ADMIN PREVIEW API] Prompt length:', customPrompt.length, 'characters');

    // 5. Prepare image data for Gemini (remove data URL prefixes)
    const referenceImageData = referenceImageBase64.split(',')[1];
    const petImageData = petImageBase64.split(',')[1];

    // 6. Call Gemini API for subject replacement
    console.log('🤖 [ADMIN PREVIEW API] Starting Gemini generation...');
    console.log(`🎨 [ADMIN PREVIEW API] Metadata: ${JSON.stringify(metadata)}`);

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
              data: petImageData,
            },
          },
        ],
      });

      const geminiDuration = Date.now() - geminiStartTime;
      console.log(`✅ [ADMIN PREVIEW API] Gemini completed in ${geminiDuration}ms`);

      // 7. Extract generated image data
      if (!response.candidates?.[0]?.content?.parts) {
        console.error('❌ [ADMIN PREVIEW API] No candidates in response');
        throw new Error('No image data returned from Gemini');
      }

      const generatedImageData = response.candidates[0].content.parts.find(
        (part: any) => part.inlineData?.data
      )?.inlineData?.data;

      if (!generatedImageData) {
        console.error('❌ [ADMIN PREVIEW API] No image data in parts');
        throw new Error('No image data in Gemini response');
      }

      console.log('✅ [ADMIN PREVIEW API] Image generated, size:', generatedImageData.length);

      // 8. Upload to Cloudinary with admin_preview tag
      console.log('📤 [ADMIN PREVIEW API] Uploading to Cloudinary...');
      const timestamp = Date.now();
      const filename = `admin-preview-${metadata.breedName || 'pet'}-${timestamp}.png`;

      const uploadResult = await cloudinaryService.uploadAndProcessImage(
        Buffer.from(generatedImageData, 'base64'),
        filename,
        {
          breed: metadata.breedName || 'pet',
          theme: metadata.themeName || 'test',
          style: metadata.styleName || 'preview',
          format: metadata.formatName || 'square',
          tags: ['admin_preview', 'test_variation'] // Special tags for cleanup
        }
      );

      if (!uploadResult) {
        console.error('❌ [ADMIN PREVIEW API] Cloudinary upload failed');
        throw new Error('Failed to upload generated image to Cloudinary');
      }

      console.log('✅ [ADMIN PREVIEW API] Uploaded to Cloudinary:', uploadResult.public_id);

      // 9. Generate watermarked and full-size URLs
      const watermarkedUrl = cloudinaryService.getPublicVariantUrl(
        uploadResult.public_id,
        'catalog_watermarked'
      );

      const fullSizeUrl = cloudinaryService.getPublicVariantUrl(
        uploadResult.public_id,
        'full_size'
      );

      console.log('🔗 [ADMIN PREVIEW API] Watermarked URL:', watermarkedUrl.substring(0, 100));

      // 10. Return response with metadata for admin debugging
      console.log('✅ [ADMIN PREVIEW API] Success! Returning response');
      return NextResponse.json({
        success: true,
        watermarkedUrl,
        fullSizeUrl, // Admin can download full quality
        metadata: {
          generationTimeMs: geminiDuration,
          geminiModel: 'gemini-3-pro-image-preview',
          promptUsed: customPrompt, // Admin can see exact prompt
          cloudinaryPublicId: uploadResult.public_id,
          ...metadata
        }
      });

    } catch (geminiError: any) {
      console.error('❌ [ADMIN PREVIEW API] Gemini generation error:', {
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
    console.error('❌ [ADMIN PREVIEW API] Unexpected error:', error);
    return NextResponse.json(
      {
        error: 'Preview generation failed',
        message: 'An error occurred while generating the preview variation.',
        details: error.message
      },
      { status: 500 }
    );
  }
}

/**
 * Build subject replacement prompt for Gemini
 * Reuses public endpoint prompt structure with composition template integration
 */
function buildSubjectReplacementPrompt(
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
- The EXACT position and pose of the subject`;

  return `CRITICAL INSTRUCTION: MODIFY THE REFERENCE IMAGE, DO NOT CREATE A NEW IMAGE

You are given a reference portrait image. Your task is to MODIFY this EXACT image by REPLACING ONLY the subject with the subject from the uploaded photo.

PRESERVATION REQUIREMENTS (THESE MUST REMAIN IDENTICAL):
${preservationRequirements}

REPLACEMENT REQUIREMENT (ONLY THIS CHANGES):
- Replace the original subject with the subject from the uploaded photo
- The new subject must have the EXACT physical appearance from the uploaded photo (coloring, markings, facial features, fur/hair patterns, distinctive characteristics)

CRITICAL POSE AND POSITION TRANSFORMATION:
- The new subject MUST adopt the EXACT SAME POSE as the original subject in the reference image
- If the reference subject is sitting, the new subject must be sitting in the same way
- If the reference subject is standing, the new subject must stand in the same position
- Match the head tilt, ear position, leg placement, and body orientation EXACTLY
- The new subject must occupy the SAME SPATIAL POSITION in the frame as the original
- DO NOT use the pose from the uploaded pet photo - the pose MUST match the reference image pose
- The uploaded photo is ONLY for the pet's physical appearance (colors, markings) - NOT for pose or background

CRITICAL STYLE TRANSFORMATION:
- The new subject must be rendered in the EXACT SAME artistic medium as the reference
- If reference is oil painting, paint the new subject in oil paint style with visible brushstrokes
- If reference is watercolor, render as watercolor with soft edges and color bleeds
- If reference is digital art, match the digital art style exactly
- If reference is photograph, render as photographic style
- DO NOT make the subject look like the uploaded photo's style - transform it to match the reference style
- The uploaded photo is a REFERENCE for appearance only - the final render MUST match the reference artistic style
- Match the lighting, shadows, and highlights of the reference portrait exactly

Reference Portrait Metadata:
- Theme: ${metadata?.themeName || 'original theme'}
- Style: ${metadata?.styleName || 'original style'}
- Format: ${metadata?.formatName || 'original format'}
- Target Breed: ${metadata?.breedName || 'original breed'}

CRITICAL VERIFICATION:
- If someone compared your output to the reference image, the ONLY differences should be:
  1. The subject's physical appearance (colors, markings, breed characteristics)
- Everything else MUST be IDENTICAL:
  1. Pose and body position (head angle, legs, ears, tail)
  2. Spatial position in frame (where the subject is located)
  3. Background, composition, lighting, style, props
- DO NOT use the pose from the uploaded photo - USE THE POSE FROM THE REFERENCE
- DO NOT use the style from the uploaded photo - USE THE STYLE FROM THE REFERENCE
- This is a subject REPLACEMENT task with pose and style transformation, NOT a new image generation task`;
}
