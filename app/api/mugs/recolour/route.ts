import { NextRequest, NextResponse } from 'next/server';
import { serviceClient } from '@/lib/qr/server';
import { getRequester } from '@/lib/guest/access';
import type { MugColour, MugCatalogEntry } from '@/lib/product-types';
import { compositeParams, saveMugAsCustomImage } from '@/lib/mugs/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/mugs/recolour   { generation_id, mug_colour_slug }
 * New colour for a finished mug: rebuilds the wrap (no new painting) and updates the saved mug,
 * so a basket line for it prints in the new colour. Only the device or customer that made it.
 */
export async function POST(request: NextRequest) {
  try {
    const { generation_id, mug_colour_slug } = await request.json();
    if (!generation_id || !mug_colour_slug) return NextResponse.json({ error: 'generation_id and mug_colour_slug are required' }, { status: 400 });

    const requester = await getRequester(request);
    const supabase = serviceClient();
    const { data: generation } = await supabase.from('mug_generations').select('*').eq('id', generation_id).maybeSingle();
    if (!generation) return NextResponse.json({ error: 'Mug not found' }, { status: 404 });

    let owns = !!requester.guestId && generation.session_id === requester.guestId;
    if (!owns && requester.user?.email) {
      const { data: profile } = await supabase.from('user_profiles').select('id').eq('email', requester.user.email).maybeSingle();
      owns = !!profile && generation.customer_id === profile.id;
    }
    if (!owns) return NextResponse.json({ error: 'Mug not found' }, { status: 404 });
    if (!['complete', 'purchased'].includes(generation.status) || !generation.personalised_image_public_id) {
      return NextResponse.json({ error: 'This mug isn’t finished yet' }, { status: 400 });
    }

    const [{ data: colour }, { data: entry }, { data: custom }] = await Promise.all([
      supabase.from('mug_colours').select('*').eq('slug', mug_colour_slug).eq('is_active', true).maybeSingle(),
      supabase.from('mug_catalog').select('*').eq('id', generation.mug_catalog_id).maybeSingle(),
      supabase.from('customer_custom_images').select('id').eq('generation_metadata->>mug_generation_id', generation_id).maybeSingle(),
    ]);
    if (!colour) return NextResponse.json({ error: 'Colour not found' }, { status: 404 });
    if (!entry) return NextResponse.json({ error: 'Design not found' }, { status: 404 });

    const params = compositeParams(generation.personalised_image_public_id, generation.pet_name, colour as MugColour, entry as MugCatalogEntry);
    const saved = await saveMugAsCustomImage(supabase, {
      generationId: generation_id,
      existingCustomImageId: custom?.id ?? null,
      owner: { customerId: null, customerEmail: requester.user?.email ?? null, guestId: requester.guestId },
      params,
      petPhotoUrl: generation.pet_photo_url,
      petPhotoPublicId: generation.pet_photo_public_id,
      colour: colour as MugColour,
      entry: entry as MugCatalogEntry,
    });

    await supabase.from('mug_generations').update({
      mug_colour_id: colour.id,
      composite_preview_url: saved.previewUrl,
      composite_print_url: saved.printUrl,
      updated_at: new Date().toISOString(),
    }).eq('id', generation_id);

    return NextResponse.json({ custom_image_id: saved.customImageId, preview_url: saved.previewUrl });
  } catch (error) {
    console.error('Mug recolour failed:', error);
    return NextResponse.json({ error: 'Couldn’t change the colour. Please try again.' }, { status: 500 });
  }
}
