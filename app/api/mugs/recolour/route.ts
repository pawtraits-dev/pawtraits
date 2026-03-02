import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { buildMugPreviewUrl, buildMugPrintUrl } from '@/lib/cloudinary-mug';
import type { MugColour, MugCatalogEntry } from '@/lib/product-types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const dynamic = 'force-dynamic';

// POST /api/mugs/recolour
// Body: { generation_id, mug_colour_slug, customer_email?, session_id? }
// Re-runs Stage 2 (Cloudinary composite) only — no Gemini call.
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const body = await request.json();
    const { generation_id, mug_colour_slug, customer_email, session_id } = body;

    if (!generation_id || !mug_colour_slug) {
      return NextResponse.json(
        { error: 'generation_id and mug_colour_slug are required' },
        { status: 400 }
      );
    }

    if (!customer_email && !session_id) {
      return NextResponse.json(
        { error: 'Either customer_email (authenticated) or session_id (guest) is required' },
        { status: 400 }
      );
    }

    // Auth check for authenticated users
    if (customer_email) {
      const cookieStore = await cookies();
      const supabaseAuth = createRouteHandlerClient({ cookies: () => cookieStore });
      const { data: { user } } = await supabaseAuth.auth.getUser();

      if (!user || user.email !== customer_email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    // Fetch the existing generation record
    const { data: generation, error: genError } = await supabase
      .from('mug_generations')
      .select('*')
      .eq('id', generation_id)
      .single();

    if (genError || !generation) {
      return NextResponse.json({ error: 'Generation not found' }, { status: 404 });
    }

    // Verify ownership
    if (customer_email) {
      // Authenticated: verify customer_id matches
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('email', customer_email)
        .single();

      if (!profile || generation.customer_id !== profile.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }
    } else {
      // Guest: verify session_id matches
      if (generation.session_id !== session_id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }
    }

    // Generation must be complete to recolour
    if (generation.status !== 'complete' && generation.status !== 'purchased') {
      return NextResponse.json(
        { error: 'Generation is not complete yet' },
        { status: 400 }
      );
    }

    if (!generation.personalised_image_public_id) {
      return NextResponse.json(
        { error: 'No personalised image found on this generation' },
        { status: 400 }
      );
    }

    // Fetch new colour
    const { data: newColour, error: colourError } = await supabase
      .from('mug_colours')
      .select('*')
      .eq('slug', mug_colour_slug)
      .eq('is_active', true)
      .single();

    if (colourError || !newColour) {
      return NextResponse.json({ error: 'Mug colour not found' }, { status: 404 });
    }

    // Fetch catalog entry
    const { data: catalogEntry, error: catalogError } = await supabase
      .from('mug_catalog')
      .select('*')
      .eq('id', generation.mug_catalog_id)
      .single();

    if (catalogError || !catalogEntry) {
      return NextResponse.json({ error: 'Catalog entry not found' }, { status: 404 });
    }

    // Re-run Stage 2 only — rebuild composite URLs with new colour
    const compositeParams = {
      personalisedImagePublicId: generation.personalised_image_public_id,
      petName: generation.pet_name,
      mugColour: newColour as MugColour,
      catalogEntry: catalogEntry as MugCatalogEntry,
    };

    const previewUrl = buildMugPreviewUrl(compositeParams);
    const printUrl = buildMugPrintUrl(compositeParams);

    // Update record with new colour and composite URLs
    const { error: updateError } = await supabase
      .from('mug_generations')
      .update({
        mug_colour_id: newColour.id,
        composite_preview_url: previewUrl,
        composite_print_url: printUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', generation_id);

    if (updateError) throw updateError;

    return NextResponse.json({ preview_url: previewUrl, print_url: printUrl });

  } catch (error) {
    console.error('Mug recolour failed:', error);
    return NextResponse.json({ error: 'Recolour failed' }, { status: 500 });
  }
}
