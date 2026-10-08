import { buildMultiSubjectReplacementPrompt, VariationPromptBuilder, type SlotReplacement } from '@/lib/variation-prompt-builder';
import { GEMINI_IMAGE_MODELS, GEMINI_IMAGE_SIZES, geminiImageConfig, ratioOfImage } from '@/lib/gemini-models';

/**
 * The customer painting request (customise page), in one place so the admin size test
 * (/admin/size-test) sends exactly what customers send, at whatever size it's comparing.
 */

/** Size of customer previews. 1K is quicker on a phone; the 4K print master is made on purchase. */
export const CUSTOMER_PREVIEW_SIZE = process.env.GEMINI_CUSTOMER_PREVIEW_SIZE || GEMINI_IMAGE_SIZES.preview;

export interface PaintingPromptInput {
  variationPromptTemplate?: string;
  aspectRatio?: string;
  sizeInstruction?: string;
  slotPlan?: SlotReplacement[];
  petCount: number;
  themeName: string;
  styleName: string;
  breedName: string;
  petCharacteristics?: { pose?: string; gaze?: string; expression?: string; detectedBreed?: string; detectedCoat?: string };
}

const promptBuilder = new VariationPromptBuilder();

export function buildPaintingPrompt(p: PaintingPromptInput): string {
  if (p.slotPlan && p.slotPlan.length > 1 && p.slotPlan.length === p.petCount) {
    return buildMultiSubjectReplacementPrompt({
      compositionTemplate: p.variationPromptTemplate, aspectRatio: p.aspectRatio, sizeInstruction: p.sizeInstruction, slots: p.slotPlan,
      metadata: { themeName: p.themeName, styleName: p.styleName, formatName: 'portrait' },
    });
  }
  return promptBuilder.buildSubjectReplacementPrompt({
    compositionTemplate: p.variationPromptTemplate,
    aspectRatio: p.aspectRatio,
    sizeInstruction: p.sizeInstruction,
    metadata: { breedName: p.breedName, themeName: p.themeName, styleName: p.styleName, formatName: 'portrait', petCharacteristics: p.petCharacteristics },
  });
}

const strip = (b64: string) => (b64.startsWith('data:') ? b64.split(',')[1] : b64);

/** generateContent request: prompt, the design, then each pet photo */
export function paintingRequest(opts: { prompt: string; catalogImageData: string; petImageData: string[]; aspectRatio?: string; imageSize?: string }) {
  const catalog = strip(opts.catalogImageData);
  return {
    model: GEMINI_IMAGE_MODELS.pro,
    contents: [
      { text: opts.prompt },
      { inlineData: { mimeType: 'image/png', data: catalog } },
      ...opts.petImageData.map((d) => ({ inlineData: { mimeType: 'image/png', data: strip(d) } })),
    ],
    config: {
      responseModalities: ['IMAGE', 'TEXT'],
      ...geminiImageConfig(opts.aspectRatio || ratioOfImage(catalog), opts.imageSize ?? CUSTOMER_PREVIEW_SIZE),
    },
  };
}

/** The first image in a Gemini response, as base64 */
export function imageFrom(response: any): string | null {
  for (const part of response?.candidates?.[0]?.content?.parts ?? []) if (part?.inlineData?.data) return part.inlineData.data;
  return null;
}
