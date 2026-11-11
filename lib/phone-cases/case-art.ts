/**
 * Phone-case art (server). For one design and one layout group:
 *   1. place the 2:3 painting in the group's 9:16 canvas (caseArtLayout), the rest flat grey;
 *   2. Gemini paints the grey: the background continued, nothing new where the camera sits;
 *   3. the ORIGINAL painting is pasted back exactly into its slot (edges feathered over a few px),
 *      so the pet, faces and lettering are the untouched originals and the slot never moves;
 *   4. upload to Cloudinary and save as image_catalog.case_art[group] (status 'pending').
 * A customer's customised painting goes into the same slot the same way (phase 3), which is why
 * their pet can never change size or position on the case.
 */
import { GoogleGenAI } from '@google/genai';
import { v2 as cloudinary } from 'cloudinary';
import { createCanvas, loadImage, type Image } from 'canvas';
import type { SupabaseClient } from '@supabase/supabase-js';
import { GEMINI_IMAGE_MODELS, GEMINI_IMAGE_SIZES, geminiImageConfig } from '@/lib/gemini-models';
import { generateWithUsage } from '@/lib/ai/usage';
import { imageFrom } from '@/lib/customise/painting';
import { CASE_ART_RATIO, caseArtLayout, type CaseArtEntry, type CaseArtLayout, type PhoneModel } from './geometry';

const GREY = '#808080';
const INPUT_W = 1152;                 // Gemini input canvas width (9:16 → 2048 tall)
const FEATHER = 0.02;                 // feather the pasted painting's edges over 2% of its width

export const CASE_ART_PROMPT = `This image is a finished painting placed inside a larger canvas. Everything flat mid-grey around it is empty canvas.

Extend the painting into ALL of the grey area so the whole canvas becomes one seamless picture:
- Continue the existing background naturally: the same scene, walls, sky, ground, lighting, perspective, colours, texture and painting style.
- The painting itself must stay EXACTLY as it is: same pet, same face, same clothes and lettering, same size and same position. Do not redraw, move, crop, zoom or reframe it.
- The new area above the painting is quiet background only: no animals, people, faces, text, logos, numbers or eye-catching objects, especially in the top-left corner (a phone camera covers it).
- No borders, frames, vignettes, panels or visible seams. Keep the full canvas size.`;

function configure() {
  if (!cloudinary.config().cloud_name) {
    cloudinary.config({ cloud_name: process.env.CLOUDINARY_CLOUD_NAME, api_key: process.env.CLOUDINARY_API_KEY, api_secret: process.env.CLOUDINARY_API_SECRET, secure: true });
  }
}

function sourceUrl(publicId: string, width: number) {
  configure();
  return cloudinary.url(publicId, { secure: true, type: 'upload', format: 'png', width: Math.round(width), crop: 'scale', sign_url: false });
}

/** The painting drawn with its outer edge feathered, so it melts into the generated surround */
function featheredPainting(img: Image, w: number, h: number) {
  const c = createCanvas(Math.round(w), Math.round(h));
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0, c.width, c.height);
  const f = Math.max(2, Math.round(c.width * FEATHER));
  g.globalCompositeOperation = 'destination-out';
  const edge = (x0: number, y0: number, x1: number, y1: number, rx: number, ry: number, rw: number, rh: number) => {
    const grad = g.createLinearGradient(x0, y0, x1, y1);
    grad.addColorStop(0, 'rgba(0,0,0,1)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad; g.fillRect(rx, ry, rw, rh);
  };
  edge(0, 0, 0, f, 0, 0, c.width, f);                                   // top
  edge(0, c.height, 0, c.height - f, 0, c.height - f, c.width, f);      // bottom
  edge(0, 0, f, 0, 0, 0, f, c.height);                                  // left
  edge(c.width, 0, c.width - f, 0, c.width - f, 0, f, c.height);        // right
  return c;
}

/** 0–1 likeness of two images over the same box (grey, downscaled): did Gemini keep the painting in place? */
function likeness(a: Image, b: Image, box: { x: number; y: number; w: number; h: number }, bScale: number) {
  const W = 48, H = 72;
  const sample = (img: Image, sx: number, sy: number, sw: number, sh: number) => {
    const c = createCanvas(W, H); const g = c.getContext('2d');
    g.drawImage(img, sx, sy, sw, sh, 0, 0, W, H);
    const d = g.getImageData(0, 0, W, H).data; const out = new Float32Array(W * H);
    for (let i = 0; i < out.length; i++) out[i] = (d[i * 4] * 0.299 + d[i * 4 + 1] * 0.587 + d[i * 4 + 2] * 0.114) / 255;
    return out;
  };
  const pa = sample(a, 0, 0, a.width, a.height);
  const pb = sample(b, box.x * bScale, box.y * bScale, box.w * bScale, box.h * bScale);
  let sum = 0; for (let i = 0; i < pa.length; i++) sum += Math.abs(pa[i] - pb[i]);
  return Math.max(0, Math.round((1 - (sum / pa.length) * 4) * 100) / 100);
}

export async function generateCaseArt(db: SupabaseClient, designId: string, groupId: string): Promise<CaseArtEntry> {
  const { data: design, error } = await db.from('image_catalog')
    .select('id, cloudinary_public_id, case_art, formats(aspect_ratio)').eq('id', designId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!design?.cloudinary_public_id) throw new Error('Design not found');
  const ratio = (design as any).formats?.aspect_ratio;
  if (ratio && ratio.replace('/', ':') !== '2:3') throw new Error(`Phone cases need a 2:3 portrait design (this one is ${ratio})`);

  const { data: models } = await db.from('phone_models').select('*').eq('layout_group', groupId);
  if (!models?.length) throw new Error(`No phone models in layout ${groupId}`);
  const layout: CaseArtLayout = caseArtLayout(models as PhoneModel[]);

  // 1. Input canvas
  const inPx = INPUT_W / layout.cw;
  const painting = await loadImage(sourceUrl(design.cloudinary_public_id, layout.slot.w * inPx * 2));
  const input = createCanvas(INPUT_W, Math.round(layout.ch * inPx));
  const gi = input.getContext('2d');
  gi.fillStyle = GREY; gi.fillRect(0, 0, input.width, input.height);
  gi.drawImage(painting, layout.slot.x * inPx, layout.slot.y * inPx, layout.slot.w * inPx, layout.slot.h * inPx);

  // 2. Gemini
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY not set');
  const ai = new GoogleGenAI({ apiKey: key });
  const request = {
    model: GEMINI_IMAGE_MODELS.pro,
    contents: [{ text: CASE_ART_PROMPT }, { inlineData: { mimeType: 'image/jpeg', data: input.toBuffer('image/jpeg', { quality: 0.95 }).toString('base64') } }],
    config: { responseModalities: ['IMAGE', 'TEXT'], ...geminiImageConfig(CASE_ART_RATIO, GEMINI_IMAGE_SIZES.preview) },
  };
  const response = await generateWithUsage(ai, { feature: 'phone-case-art', imageId: designId, meta: { group: groupId } }, request);
  const out = imageFrom(response);
  if (!out) throw new Error('Gemini returned no image');
  const generated = await loadImage(Buffer.from(out, 'base64'));

  // 3. Paste the original painting back, exactly in its slot
  const outPx = generated.width / layout.cw;
  const H = Math.round(layout.ch * outPx);
  const final = createCanvas(generated.width, H);
  const gf = final.getContext('2d');
  gf.drawImage(generated, 0, 0, final.width, H);
  const match = likeness(painting, generated, layout.slot, generated.width / layout.cw);
  const full = await loadImage(sourceUrl(design.cloudinary_public_id, layout.slot.w * outPx));
  gf.drawImage(featheredPainting(full, layout.slot.w * outPx, layout.slot.h * outPx), Math.round(layout.slot.x * outPx), Math.round(layout.slot.y * outPx));

  // 4. Upload and save
  configure();
  const uploaded = await cloudinary.uploader.upload(`data:image/jpeg;base64,${final.toBuffer('image/jpeg', { quality: 0.93 }).toString('base64')}`, {
    folder: 'pawtraits/phone-cases/case-art', public_id: `${designId}-${groupId}-${Date.now()}`, resource_type: 'image', tags: ['phone-case-art', `layout-${groupId}`],
  });
  const entry: CaseArtEntry = {
    public_id: uploaded.public_id, width: uploaded.width, height: uploaded.height, layout,
    status: 'pending', match, created_at: new Date().toISOString(), approved_at: null,
  };
  const caseArt = { ...((design as any).case_art || {}), [groupId]: entry };
  const { error: saveError } = await db.from('image_catalog').update({ case_art: caseArt }).eq('id', designId);
  if (saveError) throw new Error(saveError.message);
  return entry;
}

export async function setCaseArtStatus(db: SupabaseClient, designId: string, groupId: string, status: 'approved' | 'rejected') {
  const { data } = await db.from('image_catalog').select('case_art').eq('id', designId).maybeSingle();
  const art = (data?.case_art || {}) as Record<string, CaseArtEntry>;
  if (!art[groupId]) throw new Error('No case art for that layout yet');
  art[groupId] = { ...art[groupId], status, approved_at: status === 'approved' ? new Date().toISOString() : null };
  const { error } = await db.from('image_catalog').update({ case_art: art }).eq('id', designId);
  if (error) throw new Error(error.message);
  return art[groupId];
}
