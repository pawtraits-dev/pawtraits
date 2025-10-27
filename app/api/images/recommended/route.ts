import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

/**
 * POST /api/images/recommended
 * Returns catalog images matching customer's pet breed+coat combinations
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Parse request body
    const { petCombinations } = await request.json();

    if (!petCombinations || !Array.isArray(petCombinations) || petCombinations.length === 0) {
      return NextResponse.json({ images: [] });
    }

    // Use service role client for database operations
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Build query to match any of the breed combinations
    // Strategy: Match by breed AND coat for precise recommendations
    let query = supabaseAdmin
      .from('image_catalog')
      .select(`
        id,
        filename,
        public_url,
        prompt_text,
        description,
        tags,
        breed_id,
        coat_id,
        theme_id,
        style_id,
        format_id,
        rating,
        is_featured,
        created_at,
        breeds!inner (
          id,
          name,
          animal_type
        ),
        themes (
          id,
          name
        ),
        styles (
          id,
          name
        )
      `);

    // Build OR conditions for breed+coat combinations
    const validCombinations = petCombinations.filter((combo: any) => combo.breed_id && combo.coat_id);

    if (validCombinations.length > 0) {
      // Match images where BOTH breed AND coat match any pet combination
      const orConditions = validCombinations.map((combo: any) =>
        `and(breed_id.eq.${combo.breed_id},coat_id.eq.${combo.coat_id})`
      ).join(',');

      query = query.or(orConditions);
    } else {
      // Fallback to breed-only if no coat data available
      const breedIds = [...new Set(petCombinations.map((combo: any) => combo.breed_id).filter(Boolean))];

      if (breedIds.length > 0) {
        query = query.in('breed_id', breedIds);
      } else {
        // No valid combinations, return empty
        return NextResponse.json({ success: true, images: [] });
      }
    }

    // Limit results and order by rating
    query = query
      .order('rating', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(20);

    const { data: images, error } = await query;

    if (error) {
      console.error('Error fetching recommended images:', error);
      return NextResponse.json({ error: 'Failed to fetch recommended images' }, { status: 500 });
    }

    // Deduplicate by image ID (in case of overlaps)
    const uniqueImages = Array.from(
      new Map(images?.map(img => [img.id, img]) || []).values()
    );

    return NextResponse.json({
      success: true,
      images: uniqueImages
    });

  } catch (error) {
    console.error('Unexpected error fetching recommended images:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
