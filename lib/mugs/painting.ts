/**
 * Mug painting uses the SAME prompt and request as the main customisation (lib/customise/painting.ts):
 * buildPaintingPrompt + paintingRequest (the Pro image model, preview size), with the design's
 * composition template from the Claude composition analysis, so the pet is painted INTO the design's
 * style instead of pasted in. Mug designs aren't catalogue designs, so their template is made on
 * first use (ClaudeCompositionAnalyzer, the same analysis the catalogue upload runs) and cached on
 * mug_catalog.variation_prompt_template.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { ClaudeCompositionAnalyzer } from '@/lib/claude-composition-analyzer';
import { buildPaintingPrompt, paintingRequest } from '@/lib/customise/painting';
import type { MugCatalogEntry } from '@/lib/product-types';

type Img = { data: string; mimeType: string };

/** The design's composition template: cached, else analysed now (best effort: undefined on failure) */
export async function mugTemplate(supabase: SupabaseClient, entry: MugCatalogEntry & { variation_prompt_template?: string | null }, scene: Img): Promise<string | undefined> {
  if (entry.variation_prompt_template) return entry.variation_prompt_template;
  try {
    const analysis = await new ClaudeCompositionAnalyzer().analyzeImage({
      imageBase64: scene.data,
      imageFormat: (['image/jpeg', 'image/png', 'image/webp'].includes(scene.mimeType) ? scene.mimeType : 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/webp',
      context: { theme: entry.name },
    });
    const template = analysis.variationPromptTemplate;
    if (template) {
      await supabase.from('mug_catalog').update({ variation_prompt_template: template, template_analysed_at: new Date().toISOString() }).eq('id', entry.id);
    }
    return template || undefined;
  } catch (e) {
    console.error(`Mug design ${entry.slug}: composition analysis failed, using the standard preservation list`, e);
    return undefined;
  }
}

/** Prompt + Gemini request for painting the pet into a mug design: the customisation prompt, plus the mug colour */
export function mugPaintingRequest(opts: { entry: MugCatalogEntry; template?: string; scene: Img; pet: Img; colourHex: string }) {
  const prompt = buildPaintingPrompt({
    variationPromptTemplate: opts.template,
    aspectRatio: '1:1',
    petCount: 1,
    themeName: opts.entry.name,
    styleName: 'the reference image’s own style',
    breedName: opts.entry.type === 'breed' ? opts.entry.name : 'pet',
  }) + `\n\nMUG COLOUR: recolour the decorative highlight elements only (crown, collar, hat, ribbons, scarves, props) to #${opts.colourHex.replace('#', '')}. Do not add any text.`;
  const request = paintingRequest({
    prompt,
    catalogImageData: opts.scene.data,
    catalogMimeType: opts.scene.mimeType,
    petImageData: [opts.pet.data],
    petMimeTypes: [opts.pet.mimeType],
    aspectRatio: '1:1',
  });
  return { prompt, request };
}
