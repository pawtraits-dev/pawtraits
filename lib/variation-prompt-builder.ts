/**
 * Variation Prompt Builder
 *
 * Shared service for building consistent Gemini prompts for subject replacement in pet portraits.
 * Used by both admin preview variation and customer custom image generation.
 *
 * Ensures that all variations maintain:
 * - Exact background from reference image
 * - Exact composition, framing, and camera angle
 * - Exact lighting setup, shadows, and highlights
 * - Exact artistic style and props
 * - Only the pet subject is replaced
 */

export interface VariationPromptOptions {
  compositionTemplate?: string;  // From Claude AI analysis (stored in catalog)
  metadata: {
    breedName?: string;
    themeName?: string;
    styleName?: string;
    formatName?: string;
  };
}

export class VariationPromptBuilder {
  /**
   * Build subject replacement prompt for Gemini
   * Used by both admin preview and customer generation endpoints
   *
   * @param options - Composition template and metadata
   * @returns Structured prompt for Gemini API
   */
  buildSubjectReplacementPrompt(options: VariationPromptOptions): string {
    const { compositionTemplate, metadata } = options;

    // Use Claude-generated template if available, otherwise use fallback
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
}
