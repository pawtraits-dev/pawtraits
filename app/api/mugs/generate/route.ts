import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { v2 as cloudinary } from 'cloudinary';
import { serviceClient } from '@/lib/qr/server';
import { getRequester, setGuestCookie, clientIp } from '@/lib/guest/access';
import { hashIp } from '@/lib/qr/attribution';
import { getSetting } from '@/lib/app-settings';
import type { MugColour, MugCatalogEntry } from '@/lib/product-types';
import { GEMINI_IMAGE_MODELS, geminiImageConfig } from '@/lib/gemini-models';
import { generateWithUsage } from '@/lib/ai/usage';
import { compositeParams, saveMugAsCustomImage, wideFormatId } from '@/lib/mugs/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 120; // Gemini + composite + upload

/**
 * POST /api/mugs/generate
 * Body: { catalog_slug, pet_photo_public_id, pet_name, mug_colour_slug }
 * Signed-in customer or guest (device cookie). Paints the pet into the design's scene, builds the
 * mug wrap, and saves it as a customised Pawtrait so it can be bought like one.
 * Returns { generation_id, custom_image_id, preview_url, format_id }.
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const supabase = serviceClient();
  const requester = await getRequester(request, { createGuest: true });
  const reply = (body: any, init?: ResponseInit) => setGuestCookie(NextResponse.json(body, init), requester);
  let generationId: string | null = null;

  try {
    const { catalog_slug, pet_photo_public_id, pet_name, mug_colour_slug } = await request.json();
    const name = String(pet_name || '').trim();
    if (!catalog_slug || !pet_photo_public_id || !name || !mug_colour_slug) {
      return reply({ error: 'Choose a design and colour, add a photo and your pet’s name' }, { status: 400 });
    }
    if (name.length > 20) return reply({ error: 'Pet name must be 20 characters or fewer' }, { status: 400 });
    // Only photos uploaded through /api/mugs/upload
    if (!String(pet_photo_public_id).startsWith('pawtraits/mugs/pet-photos/')) return reply({ error: 'Please upload your photo again' }, { status: 400 });

    // Who is it for?
    let customer: { id: string; email: string } | null = null;
    let profileId: string | null = null;
    if (requester.user?.email) {
      const email = requester.user.email;
      const [{ data: c }, { data: p }] = await Promise.all([
        supabase.from('customers').select('id, email').eq('email', email).maybeSingle(),
        supabase.from('user_profiles').select('id').eq('email', email).maybeSingle(),
      ]);
      customer = c ?? null;
      profileId = p?.id ?? null;
    }
    const ipHash = hashIp(clientIp(request));

    // Same daily free-preview limit as customised paintings, for guests
    if (!requester.user) {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const [limit, { count }] = await Promise.all([
        getSetting('guest_preview_daily_limit'),
        supabase.from('mug_generations').select('id', { count: 'exact', head: true }).eq('session_id', requester.guestId!).gte('created_at', since),
      ]);
      if ((count ?? 0) >= limit) {
        return reply({ error: "You've made today's free previews. Create a free account (or come back tomorrow) to make more.", code: 'GUEST_LIMIT_REACHED' }, { status: 429 });
      }
    }

    const [catalogResult, colourResult, formatId] = await Promise.all([
      supabase.from('mug_catalog').select('*').eq('slug', catalog_slug).eq('is_active', true).maybeSingle(),
      supabase.from('mug_colours').select('*').eq('slug', mug_colour_slug).eq('is_active', true).maybeSingle(),
      wideFormatId(supabase),
    ]);
    if (!catalogResult.data) return reply({ error: 'Design not found' }, { status: 404 });
    if (!colourResult.data) return reply({ error: 'Colour not found' }, { status: 404 });
    const entry = catalogResult.data as MugCatalogEntry;
    const colour = colourResult.data as MugColour;

    if (!cloudinary.config().cloud_name) {
      cloudinary.config({ cloud_name: process.env.CLOUDINARY_CLOUD_NAME, api_key: process.env.CLOUDINARY_API_KEY, api_secret: process.env.CLOUDINARY_API_SECRET, secure: true });
    }
    const petPhotoUrl = cloudinary.url(pet_photo_public_id, { secure: true });

    const { data: generation, error: insertError } = await supabase.from('mug_generations').insert({
      customer_id: profileId,
      session_id: requester.user ? null : requester.guestId,
      mug_catalog_id: entry.id,
      mug_colour_id: colour.id,
      pet_name: name,
      pet_photo_url: petPhotoUrl,
      pet_photo_public_id,
      status: 'generating',
    }).select('id').single();
    if (insertError || !generation) throw new Error(`Failed to create generation record: ${insertError?.message}`);
    generationId = generation.id;

    // Stage 1: paint the pet into the design's scene
    const geminiPrompt = buildGeminiPrompt(colour.hex);
    const [scene, pet] = await Promise.all([fetchImage(entry.catalog_image_url), fetchImage(petPhotoUrl)]);
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
    const geminiResponse: any = await generateWithUsage(ai, { feature: 'mug', meta: { generationId } }, {
      model: GEMINI_IMAGE_MODELS.flash,
      contents: [{ role: 'user', parts: [
        { text: geminiPrompt },
        { inlineData: { mimeType: scene.mimeType, data: scene.data } },
        { inlineData: { mimeType: pet.mimeType, data: pet.data } },
      ] }],
      config: { responseModalities: ['IMAGE', 'TEXT'], ...geminiImageConfig('1:1', '1K') },
    });
    const painted: string | undefined = geminiResponse.candidates?.[0]?.content?.parts?.find((p: any) => p?.inlineData?.data)?.inlineData?.data;
    if (!painted) throw new Error('Gemini did not return an image');

    const uploadResult: any = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        { folder: 'pawtraits/mugs/generated', resource_type: 'image', tags: ['mug-generated', `generation-${generationId}`] },
        (e, r) => (e ? reject(e) : resolve(r)),
      ).end(Buffer.from(painted, 'base64'));
    });

    // Stage 2: the mug wrap, saved as a customised Pawtrait so it can be bought
    const params = compositeParams(uploadResult.public_id, name, colour, entry);
    const saved = await saveMugAsCustomImage(supabase, {
      generationId: generationId!,
      owner: { customerId: customer?.id ?? null, customerEmail: customer?.email ?? requester.user?.email ?? null, guestId: requester.guestId },
      params, petPhotoUrl, petPhotoPublicId: pet_photo_public_id, colour, entry, ipHash,
    });

    await supabase.from('mug_generations').update({
      personalised_image_url: uploadResult.secure_url,
      personalised_image_public_id: uploadResult.public_id,
      composite_preview_url: saved.previewUrl,
      composite_print_url: saved.printUrl,
      status: 'complete',
      gemini_prompt: geminiPrompt,
      generation_time_ms: Date.now() - startTime,
      updated_at: new Date().toISOString(),
    }).eq('id', generationId);

    return reply({
      generation_id: generationId,
      custom_image_id: saved.customImageId,
      preview_url: saved.previewUrl,
      format_id: formatId,
    });
  } catch (error) {
    console.error('Mug generation failed:', error);
    if (generationId) {
      await supabase.from('mug_generations').update({
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        generation_time_ms: Date.now() - startTime,
        updated_at: new Date().toISOString(),
      }).eq('id', generationId);
    }
    return reply({ error: 'Pawcasso dropped his brush. Please try again.' }, { status: 500 });
  }
}

function buildGeminiPrompt(mugColourHex: string): string {
  return `Replace the animal in the reference scene image (first image) with the specific pet from the uploaded photo (second image). Preserve the exact composition, pose, background, props, and artistic style of the reference scene. Match the uploaded pet's breed, build, coat colour, markings, and facial features as closely as possible.
Recolour all decorative highlight elements (crown, collar, hat, ribbons, scarves, props) to the colour hex #${mugColourHex}.
Maintain the original artistic style (sketch / illustration / painterly) exactly.
Do not add any text to the image.
Output a square image.`;
}

async function fetchImage(url: string): Promise<{ data: string; mimeType: string }> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch image: ${url} (${response.status})`);
  const buf = Buffer.from(await response.arrayBuffer());
  const type = (response.headers.get('content-type') || 'image/jpeg').split(';')[0];
  return { data: buf.toString('base64'), mimeType: ['image/png', 'image/webp', 'image/jpeg'].includes(type) ? type : 'image/jpeg' };
}
