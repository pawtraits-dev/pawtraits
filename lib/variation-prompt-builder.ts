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
  aspectRatio?: string;  // Direct aspect ratio value (e.g., "16:9", "1:1", "3:2")
  sizeInstruction?: string;  // NEW: Relative size requirements for multi-subject portraits
  metadata: {
    breedName?: string;
    themeName?: string;
    styleName?: string;
    formatName?: string;
    petCharacteristics?: {  // AI-detected characteristics from pet photo analysis
      pose?: string;
      gaze?: string;
      expression?: string;
      detectedBreed?: string;
      detectedCoat?: string;
    };
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
    const { compositionTemplate, aspectRatio, sizeInstruction, metadata } = options;

    // Use Claude-generated template if available, otherwise use fallback
    const preservationRequirements = compositionTemplate || `- The EXACT background from the reference image
- The EXACT composition, framing, and camera angle
- The EXACT lighting setup, shadows, and highlights
- The EXACT props, objects, and scenic elements
- The EXACT color palette and mood
- The EXACT artistic style, brushwork, and texture
- The EXACT position and pose of the subject`;

    // Build enhanced replacement requirements with AI-detected characteristics
    let replacementDetails = `- Replace the original subject with the subject from the uploaded photo
- The new subject must have the EXACT physical appearance from the uploaded photo (coloring, markings, facial features, fur/hair patterns, distinctive characteristics)`;

    // Add AI-detected characteristics if available
    if (metadata.petCharacteristics) {
      const traits = metadata.petCharacteristics;
      if (traits.detectedBreed) {
        replacementDetails += `\n- Breed: ${traits.detectedBreed}`;
      }
      if (traits.detectedCoat) {
        replacementDetails += `\n- Coat: ${traits.detectedCoat}`;
      }
      if (traits.expression) {
        replacementDetails += `\n- Maintain the natural ${traits.expression} expression characteristic of this specific pet`;
      }
      if (traits.gaze || traits.pose) {
        replacementDetails += `\n- Note: Original pet typically has ${traits.gaze || 'forward'} gaze and ${traits.pose || 'natural'} posture, but MUST adopt the reference image's pose`;
      }
    }

    // Parse aspect ratio to determine orientation
    let orientationInstructions = '';
    let orientationType = '';
    if (aspectRatio) {
      const [width, height] = aspectRatio.split(':').map(Number);
      if (width > height) {
        orientationType = 'LANDSCAPE';
        orientationInstructions = `\n🎯 LANDSCAPE ORIENTATION: Output must be ${aspectRatio} (width:height)`;
      } else if (height > width) {
        orientationType = 'PORTRAIT';
        orientationInstructions = `\n🎯 PORTRAIT ORIENTATION: Output must be ${aspectRatio} (width:height)`;
      } else {
        orientationType = 'SQUARE';
        orientationInstructions = `\n🎯 SQUARE FORMAT: Output must be ${aspectRatio} (width = height)`;
      }
    }

    return `CRITICAL INSTRUCTION: MODIFY THE REFERENCE IMAGE, DO NOT CREATE A NEW IMAGE
${aspectRatio ? `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 MANDATORY OUTPUT FORMAT: ${aspectRatio}
🎯 THIS IS THE ONLY ACCEPTABLE ASPECT RATIO: ${aspectRatio}
🎯 DO NOT USE ANY OTHER ASPECT RATIO${orientationInstructions}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
` : ''}
You are given TWO images:
1. REFERENCE IMAGE (FIRST IMAGE): The portrait composition, background, style, lighting, dimensions, and aspect ratio to preserve
2. SUBJECT PHOTO (SECOND IMAGE): ONLY use this for the pet's physical appearance (coloring, markings, facial features)

Your task is to MODIFY the REFERENCE IMAGE (first image) by REPLACING ONLY the subject with the pet from the SUBJECT PHOTO (second image).

CRITICAL DIMENSIONS AND FORMAT:
${aspectRatio ? `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ REQUIRED ASPECT RATIO: ${aspectRatio}
⚠️ OUTPUT MUST BE ${aspectRatio} FORMAT
⚠️ ${orientationType} orientation is mandatory
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
` : ''}- The output image MUST have the EXACT SAME aspect ratio as the REFERENCE IMAGE (first image)${aspectRatio ? ` which is ${aspectRatio}` : ''}
- The output image MUST have the EXACT SAME width and height proportion as the REFERENCE IMAGE (first image)
- DO NOT use the aspect ratio or dimensions from the SUBJECT PHOTO (second image)
- IGNORE the background, composition, and framing of the SUBJECT PHOTO completely
- The REFERENCE IMAGE's aspect ratio${aspectRatio ? ` (${aspectRatio})` : ''} is THE ONLY CORRECT aspect ratio for the output
${aspectRatio ? `- If the reference image is ${aspectRatio}, the output MUST be ${aspectRatio} - no exceptions` : ''}

PRESERVATION REQUIREMENTS (THESE MUST REMAIN IDENTICAL):
${preservationRequirements}

REPLACEMENT REQUIREMENT (ONLY THIS CHANGES):
${replacementDetails}
${sizeInstruction ? `\n${sizeInstruction}` : ''}

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

FINAL VERIFICATION CHECKLIST:
${aspectRatio ? `✓ ⚠️ CRITICAL: Output aspect ratio is EXACTLY ${aspectRatio}
✓ ⚠️ CRITICAL: Output is NOT the aspect ratio from the pet photo
✓ ⚠️ CRITICAL: Output matches reference image aspect ratio of ${aspectRatio}
` : ''}✓ Output dimensions and aspect ratio EXACTLY match the reference image (first image)${aspectRatio ? ` (${aspectRatio})` : ''}
✓ Background, composition, and framing are IDENTICAL to reference image
✓ Only the subject has been replaced with the pet from the uploaded photo
✓ The pet adopts the pose, position, and artistic style of the reference
✓ NO elements from the uploaded photo's background or composition appear in the output

Reference Portrait Metadata:
- Theme: ${metadata?.themeName || 'original theme'}
- Style: ${metadata?.styleName || 'original style'}
- Format: ${metadata?.formatName || 'original format'}
${aspectRatio ? `- **ASPECT RATIO: ${aspectRatio}** ⚠️ THIS IS MANDATORY` : ''}
- Target Breed: ${metadata?.breedName || 'original breed'}

CRITICAL VERIFICATION:
- If someone compared your output to the reference image, the ONLY differences should be:
  1. The subject's physical appearance (colors, markings, breed characteristics)
- Everything else MUST be IDENTICAL:
  1. Pose and body position (head angle, legs, ears, tail)
  2. Spatial position in frame (where the subject is located)
  3. Background, composition, lighting, style, props${aspectRatio ? `
  4. **ASPECT RATIO (MUST BE ${aspectRatio})**` : ''}
- DO NOT use the pose from the uploaded photo - USE THE POSE FROM THE REFERENCE
- DO NOT use the style from the uploaded photo - USE THE STYLE FROM THE REFERENCE${aspectRatio ? `
- DO NOT use the aspect ratio from the uploaded photo - USE ${aspectRatio} FROM THE REFERENCE` : ''}
- This is a subject REPLACEMENT task with pose and style transformation, NOT a new image generation task${aspectRatio && orientationType ? `

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 FINAL OUTPUT REQUIREMENTS - ASPECT RATIO MUST BE ${aspectRatio}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ Output aspect ratio: ${aspectRatio} (NOT the pet photo's aspect ratio)
✓ Orientation: ${orientationType}
✓ Format: ${aspectRatio} width:height ratio
✓ Reference image format: ${aspectRatio}
✓ Generated image format: ${aspectRatio} (MUST MATCH)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━` : ''}`;
  }
}

/** One pet's place in a multi-pet design, and who replaces it (docs/specs/multi-pet-plan.md, phase 2) */
export interface SlotReplacement {
  label: string;               // "Left", "Right", "Front"…
  now: string;                 // what's there in the reference: "a sitting Beagle"
  newPet?: { name?: string | null; breed?: string | null; animalType?: string | null; coat?: string | null };
}

export interface MultiSubjectPromptOptions {
  compositionTemplate?: string;
  aspectRatio?: string;
  sizeInstruction?: string;
  slots: SlotReplacement[];    // in the same order as the pet photos sent after the reference image
  metadata?: { themeName?: string; styleName?: string; formatName?: string };
}

/**
 * Prompt for a design with several pets: names each pet photo against the pet it replaces
 * ("IMAGE 2 replaces the LEFT pet, currently a sitting Beagle"), so pets aren't swapped, merged
 * or dropped. Image 1 is always the reference portrait; images 2… are the pet photos in slot order.
 */
export function buildMultiSubjectReplacementPrompt(options: MultiSubjectPromptOptions): string {
  const { compositionTemplate, aspectRatio, sizeInstruction, slots, metadata } = options;
  const n = slots.length;
  const preservation = compositionTemplate || `- The EXACT background, composition, framing and camera angle
- The EXACT lighting, shadows and highlights
- The EXACT props, outfits, objects and scenery
- The EXACT colour palette, mood, artistic style, brushwork and texture
- The EXACT position, pose and size of each pet in the frame`;
  const orientation = (() => {
    if (!aspectRatio) return '';
    const [w, h] = aspectRatio.split(':').map(Number);
    return w > h ? 'LANDSCAPE' : h > w ? 'PORTRAIT' : 'SQUARE';
  })();

  // "the LEFT pet" / "pet number 3 counting from the left"
  const place = (label: string) => /^Pet \d+$/.test(label) ? `pet number ${label.slice(4)} (counting from the left)` : `${label.toUpperCase()} pet`;
  const mapping = slots.map((s, i) => {
    const kind = s.newPet ? [s.newPet.breed || s.newPet.animalType, s.newPet.coat && `(${s.newPet.coat})`].filter(Boolean).join(' ') : '';
    const article = kind ? `${/^[aeiou]/i.test(kind) ? 'an' : 'a'} ${kind}` : '';
    const who = s.newPet?.name ? [s.newPet.name, article].filter(Boolean).join(', ') : article;
    return `- IMAGE ${i + 2} replaces the ${place(s.label)} in the reference (currently ${s.now})${who ? `: this is ${who}` : ''}.`;
  }).join('\n');

  return `CRITICAL INSTRUCTION: MODIFY THE REFERENCE IMAGE, DO NOT CREATE A NEW IMAGE
${aspectRatio ? `
🎯 MANDATORY OUTPUT FORMAT: ${aspectRatio} (${orientation}). Use the reference image's shape, never a pet photo's.
` : ''}
You are given ${n + 1} images:
1. IMAGE 1 (REFERENCE): the portrait to keep. It contains ${n} pets.
${slots.map((s, i) => `${i + 2}. IMAGE ${i + 2}: a photo of the new pet for the ${place(s.label)}. Use it ONLY for that pet's appearance.`).join('\n')}

YOUR TASK: replace each of the ${n} pets in the reference with the pet from its own photo, and change nothing else.

WHO GOES WHERE (follow exactly):
${mapping}

RULES FOR SEVERAL PETS:
- The output MUST contain exactly ${n} pets: one for each photo. Never drop a pet, never add one, never merge two pets into one.
- Each new pet takes the place, pose, size in frame, outfit and props of the pet it replaces. Do not swap their places.
- Each new pet keeps ITS OWN appearance from ITS OWN photo: colouring, markings, face, ears, fur length and texture. Do not mix features between pets.
- A cat may replace a dog or a dog a cat: adapt the pose naturally to the new species while keeping the same place and attitude.
- Ignore everything in the pet photos except the pets themselves (backgrounds, people, other animals, framing, lighting).
${sizeInstruction ? `\n${sizeInstruction}\n` : ''}
PRESERVATION REQUIREMENTS (MUST REMAIN IDENTICAL):
${preservation}

STYLE:
- Render every new pet in the reference's artistic medium and lighting (oil, watercolour, digital or photographic), not the photos' style.
- Anthropomorphic outfits and accessories stay exactly as in the reference, fitted naturally to each new pet.

FINAL CHECK:
✓ Exactly ${n} pets, each matching its own photo, each in its own place (${slots.map(s => s.label).join(', ')})
✓ Background, composition, outfits, props, lighting and style identical to the reference
${aspectRatio ? `✓ Output aspect ratio is ${aspectRatio}\n` : ''}
Reference metadata: theme ${metadata?.themeName || 'original'}, style ${metadata?.styleName || 'original'}, format ${metadata?.formatName || 'original'}.`;
}
