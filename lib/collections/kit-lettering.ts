/**
 * Personalised kits (server only): put a name and number on the pet's shirt with a Gemini edit,
 * and read the shirt back with Claude Haiku to check the spelling.
 * Admin → Collections → Team versions → "Personalised kit" uses both for lettering tests; the
 * customer flow (phase 2) will reuse them.
 */
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenAI } from '@google/genai';
import sharp from 'sharp';
import { GEMINI_IMAGE_MODELS, geminiImageConfig, ratioOfImage } from '@/lib/gemini-models';
import { createWithUsage, generateWithUsage } from '@/lib/ai/usage';
import { kitLettering } from './sports-teams';

export interface KitPersonalisation {
  name: string;            // sample lettering on the design, e.g. "DAISY"
  number: number | null;   // e.g. 7
  scene: boolean;          // team switch recolours players and fans too
}

/** image_catalog.kit_personalisation → settings, or null when the design has none */
export function readKit(v: any): KitPersonalisation | null {
  if (!v || typeof v !== 'object' || !v.name) return null;
  return { name: String(v.name), number: Number.isInteger(v.number) ? v.number : null, scene: v.scene !== false };
}

/** Gemini edit: the same picture with new shirt lettering. Returns PNG base64. */
export async function paintLettering(pngBase64: string, name: string, num: number | null, ctx: { imageId?: string | null; customerImageId?: string | null } = {}): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('Gemini API key is required');
  const ai = new GoogleGenAI({ apiKey: key });
  const response = await generateWithUsage(ai, { feature: 'kit-lettering', ...ctx }, {
    model: GEMINI_IMAGE_MODELS.pro,
    config: geminiImageConfig(ratioOfImage(pngBase64)),
    contents: [
      { text: kitLettering(name, num) },
      { inlineData: { mimeType: 'image/png', data: pngBase64 } },
    ],
  });
  for (const part of response.candidates?.[0]?.content?.parts ?? []) if (part.inlineData?.data) return part.inlineData.data;
  throw new Error('The picture service returned no image');
}

export interface ShirtReading { name: string | null; number: number | null; logos: boolean; raw: string }

/** What the shirt says, read by Claude Haiku (never throws: null fields when it can't tell) */
export async function readShirt(base64: string, _media: 'image/png' | 'image/jpeg' = 'image/png', ctx: { imageId?: string | null; customerImageId?: string | null } = {}): Promise<ShirtReading> {
  const empty: ShirtReading = { name: null, number: null, logos: false, raw: '' };
  try {
    const apiKey = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return empty;
    const client = new Anthropic({ apiKey });
    // Gemini's PNGs are often over Claude's 5 MB image limit: send a 1280px JPEG instead
    const small = await sharp(Buffer.from(base64, 'base64')).resize(1280, 1280, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
    const res: any = await createWithUsage(client, { feature: 'kit-check', ...ctx }, {
      model: 'claude-haiku-4-5-20251001', max_tokens: 120,
      messages: [{ role: 'user', content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: small.toString('base64') } },
        { type: 'text', text: 'This is a painting of a pet wearing a sports shirt with a name and number on it. Read the lettering on the PET\'s shirt exactly as painted, letter by letter (do not correct spelling). Also say whether any club crest, badge, sponsor name or brand logo appears anywhere in the picture (on the pet, players or fans). Reply with JSON only: {"name": "<letters as painted, or null>", "number": <digits as painted, or null>, "logos": true | false}' },
      ] }],
    });
    const raw = (res.content ?? []).map((c: any) => (c.type === 'text' ? c.text : '')).join('');
    const m = /\{[\s\S]*\}/.exec(raw)?.[0];
    if (!m) return { ...empty, raw };
    const v = JSON.parse(m);
    const n = Number(v.number);
    return {
      name: typeof v.name === 'string' && v.name.trim() ? v.name.trim().toUpperCase() : null,
      number: v.number !== null && Number.isInteger(n) ? n : null,
      logos: v.logos === true,
      raw,
    };
  } catch (err) {
    console.warn('readShirt failed', err);
    return { ...empty, raw: String((err as any)?.message || err).slice(0, 200) };
  }
}

/** Does the reading match what was asked for? (spaces and apostrophes don't count) */
export function letteringMatches(r: ShirtReading, name: string, num: number | null): boolean {
  const norm = (s: string | null) => (s || '').replace(/[^A-Z0-9]/g, '');
  return norm(r.name) === norm(name) && (num === null ? r.number === null : r.number === num);
}
