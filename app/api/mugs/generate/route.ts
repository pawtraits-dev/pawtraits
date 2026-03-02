import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { GoogleGenAI } from '@google/genai';
import { v2 as cloudinary } from 'cloudinary';
import { buildMugPreviewUrl, buildMugPrintUrl } from '@/lib/cloudinary-mug';
import type { MugColour, MugCatalogEntry } from '@/lib/product-types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!cloudinary.config().cloud_name) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow up to 60s for Gemini + upload

// POST /api/mugs/generate
// Body: { catalog_slug, pet_photo_public_id, pet_name, mug_colour_slug, customer_email?, session_id? }
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let generationId: string | null = null;

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  try {
    const body = await request.json();
    const {
      catalog_slug,
      pet_photo_public_id,
      pet_name,
      mug_colour_slug,
      customer_email,
      session_id,
    } = body;

    // Validate required fields
    if (!catalog_slug || !pet_photo_public_id || !pet_name || !mug_colour_slug) {
      return NextResponse.json(
        { error: 'catalog_slug, pet_photo_public_id, pet_name, and mug_colour_slug are required' },
        { status: 400 }
      );
    }

    if (pet_name.length > 20) {
      return NextResponse.json({ error: 'Pet name must be 20 characters or fewer' }, { status: 400 });
    }

    if (!customer_email && !session_id) {
      return NextResponse.json(
        { error: 'Either customer_email (authenticated) or session_id (guest) is required' },
        { status: 400 }
      );
    }

    // Auth check for authenticated users
    let authenticatedUserId: string | null = null;
    if (customer_email) {
      const cookieStore = await cookies();
      const supabaseAuth = createRouteHandlerClient({ cookies: () => cookieStore });
      const { data: { user } } = await supabaseAuth.auth.getUser();

      if (!user || user.email !== customer_email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      // Get user_profiles.id (not auth.users.id)
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('email', customer_email)
        .single();

      authenticatedUserId = profile?.id || null;
    }

    // Fetch catalog entry and colour from DB
    const [catalogResult, colourResult] = await Promise.all([
      supabase.from('mug_catalog').select('*').eq('slug', catalog_slug).eq('is_active', true).single(),
      supabase.from('mug_colours').select('*').eq('slug', mug_colour_slug).eq('is_active', true).single(),
    ]);

    if (catalogResult.error || !catalogResult.data) {
      return NextResponse.json({ error: 'Catalog entry not found' }, { status: 404 });
    }
    if (colourResult.error || !colourResult.data) {
      return NextResponse.json({ error: 'Mug colour not found' }, { status: 404 });
    }

    const catalogEntry: MugCatalogEntry = catalogResult.data;
    const mugColour: MugColour = colourResult.data;

    // Get pet photo URL from Cloudinary public_id
    const petPhotoUrl = cloudinary.url(pet_photo_public_id, { secure: true });

    // Insert mug_generations row with status 'generating'
    const { data: generation, error: insertError } = await supabase
      .from('mug_generations')
      .insert({
        customer_id: authenticatedUserId,
        session_id: customer_email ? null : session_id,
        mug_catalog_id: catalogEntry.id,
        mug_colour_id: mugColour.id,
        pet_name: pet_name.trim(),
        pet_photo_url: petPhotoUrl,
        pet_photo_public_id,
        status: 'generating',
      })
      .select()
      .single();

    if (insertError || !generation) {
      throw new Error(`Failed to create generation record: ${insertError?.message}`);
    }

    generationId = generation.id;

    // ─── Stage 1: Gemini — personalise pet image ─────────────────────────────
    const geminiPrompt = buildGeminiPrompt(mugColour.hex);

    // Fetch catalog image as base64
    const catalogImageBase64 = await fetchImageAsBase64(catalogEntry.catalog_image_url);

    // Fetch pet photo as base64
    const petPhotoBase64 = await fetchImageAsBase64(petPhotoUrl);

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

    const geminiResponse = await ai.models.generateContent({
      model: 'gemini-2.0-flash-preview-image-generation',
      contents: [
        {
          role: 'user',
          parts: [
            { text: geminiPrompt },
            {
              inlineData: {
                mimeType: 'image/jpeg',
                data: catalogImageBase64,
              },
            },
            {
              inlineData: {
                mimeType: 'image/jpeg',
                data: petPhotoBase64,
              },
            },
          ],
        },
      ],
      generationConfig: {
        responseModalities: ['image', 'text'],
      },
    } as any);

    // Extract generated image from response
    let personalisedImageBase64: string | null = null;
    if (geminiResponse.candidates?.[0]?.content?.parts) {
      for (const part of geminiResponse.candidates[0].content.parts) {
        if ((part as any).inlineData?.data) {
          personalisedImageBase64 = (part as any).inlineData.data;
          break;
        }
      }
    }

    if (!personalisedImageBase64) {
      throw new Error('Gemini did not return an image');
    }

    // Upload Gemini output to Cloudinary
    const uploadResult = await cloudinary.uploader.upload(
      `data:image/png;base64,${personalisedImageBase64}`,
      {
        folder: 'pawtraits/mugs/generated',
        resource_type: 'image',
        type: 'upload',
        tags: ['mug-generated', `generation-${generationId}`],
        overwrite: false,
      }
    );

    const personalisedImagePublicId = uploadResult.public_id;
    const personalisedImageUrl = uploadResult.secure_url;

    // ─── Stage 2: Cloudinary composite ───────────────────────────────────────
    const compositeParams = {
      personalisedImagePublicId,
      petName: pet_name.trim(),
      mugColour,
      catalogEntry,
    };

    const previewUrl = buildMugPreviewUrl(compositeParams);
    const printUrl = buildMugPrintUrl(compositeParams);

    // Update generation record
    const generationTimeMs = Date.now() - startTime;
    await supabase
      .from('mug_generations')
      .update({
        personalised_image_url: personalisedImageUrl,
        personalised_image_public_id: personalisedImagePublicId,
        composite_preview_url: previewUrl,
        composite_print_url: printUrl,
        status: 'complete',
        gemini_prompt: geminiPrompt,
        generation_time_ms: generationTimeMs,
        updated_at: new Date().toISOString(),
      })
      .eq('id', generationId);

    return NextResponse.json({
      generation_id: generationId,
      preview_url: previewUrl,
      print_url: printUrl,
      personalised_image_public_id: personalisedImagePublicId,
    });

  } catch (error) {
    console.error('Mug generation failed:', error);

    // Mark generation as failed if we have an ID
    if (generationId) {
      const supabaseErr = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false }
      });
      await supabaseErr
        .from('mug_generations')
        .update({
          status: 'failed',
          error_message: error instanceof Error ? error.message : 'Unknown error',
          generation_time_ms: Date.now() - startTime,
          updated_at: new Date().toISOString(),
        })
        .eq('id', generationId);
    }

    return NextResponse.json({ error: 'Generation failed' }, { status: 500 });
  }
}

function buildGeminiPrompt(mugColourHex: string): string {
  return `Replace the animal in the reference scene image with the specific pet from the uploaded photo. Preserve the exact composition, pose, background, props, and artistic style of the reference scene. Match the uploaded pet's breed, coat colour, markings, and facial features as closely as possible.
Recolour all decorative highlight elements (crown, collar, hat, ribbons, scarves, props) to the colour hex #${mugColourHex}.
Maintain the original artistic style (sketch / illustration / painterly) exactly.
Do not add any text to the image.
Output a square image at the same resolution as the reference.`;
}

async function fetchImageAsBase64(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${url} (${response.status})`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer).toString('base64');
}
