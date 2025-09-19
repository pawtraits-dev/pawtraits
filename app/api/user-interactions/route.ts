import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    // Follow customer API pattern - use email-based authentication
    const { searchParams } = new URL(request.url);
    const customerEmail = searchParams.get('email');

    if (!customerEmail) {
      return NextResponse.json(
        { error: 'Customer email is required' },
        { status: 400 }
      );
    }

    console.log('🔍 USER-INTERACTIONS API: Fetching user interactions for email:', customerEmail);

    // Validate that the authenticated user matches the email (security check)
    const cookieStore = await cookies();
    const authSupabase = createRouteHandlerClient({ cookies: () => cookieStore });
    const { data: { user } } = await authSupabase.auth.getUser();

    console.log('🔍 USER-INTERACTIONS API: Authenticated user ID:', user?.id, 'email:', user?.email);

    if (!user?.email || user.email !== customerEmail) {
      console.error('❌ USER-INTERACTIONS API: Unauthorized - user email mismatch. User:', user?.email, 'Requested:', customerEmail);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use service role client to bypass RLS issues with user_interactions table
    const serviceRoleClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Fetch user interactions from the database
    console.log('🔍 USER-INTERACTIONS API: Querying user_interactions table for user_id:', user.id);

    const { data: interactions, error: interactionsError } = await serviceRoleClient
      .from('user_interactions')
      .select(`
        id,
        image_id,
        interaction_type,
        platform,
        created_at,
        metadata
      `)
      .eq('user_id', user.id)
      .in('interaction_type', ['like', 'share'])
      .order('created_at', { ascending: false });

    if (interactionsError) {
      console.error('❌ USER-INTERACTIONS API: Error fetching user interactions:', interactionsError);
      return NextResponse.json(
        { error: 'Failed to fetch user interactions' },
        { status: 500 }
      );
    }

    console.log('✅ USER-INTERACTIONS API: Found', interactions?.length || 0, 'user interactions');

    // Debug: Let's also check what interactions exist for any user to see if the problem is data or query
    const { data: allInteractions, error: allError } = await serviceRoleClient
      .from('user_interactions')
      .select('id, user_id, interaction_type, created_at')
      .in('interaction_type', ['like', 'share'])
      .limit(5);

    console.log('🔍 USER-INTERACTIONS API: Sample of all like/share interactions in DB:', allInteractions?.map(i => ({
      id: i.id,
      user_id: i.user_id,
      type: i.interaction_type,
      date: i.created_at
    })));

    // Now fetch the image data for these interactions
    const imageIds = [...new Set(interactions?.map(i => i.image_id) || [])];

    if (imageIds.length === 0) {
      return NextResponse.json([]);
    }

    console.log('Fetching image data for', imageIds.length, 'unique images');

    // Fetch image data from image_catalog using service role client
    const { data: images, error: imagesError } = await serviceRoleClient
      .from('image_catalog')
      .select(`
        id,
        filename,
        public_url,
        prompt_text,
        description,
        tags,
        breed_id,
        theme_id,
        style_id,
        format_id,
        rating,
        is_featured,
        created_at,
        breeds(id, name),
        themes(id, name),
        styles(id, name)
      `)
      .in('id', imageIds);

    if (imagesError) {
      console.error('Error fetching images:', imagesError);
      return NextResponse.json(
        { error: 'Failed to fetch image data' },
        { status: 500 }
      );
    }

    console.log('Found', images?.length || 0, 'images in catalog');

    // Create a map of image data for quick lookup
    const imageMap = new Map(images?.map(img => [img.id, img]) || []);

    // Combine interactions with image data
    const combinedData = interactions
      ?.map(interaction => {
        const imageData = imageMap.get(interaction.image_id);

        if (!imageData) {
          console.warn('No image data found for interaction:', interaction.image_id);
          return null;
        }

        return {
          imageId: interaction.image_id,
          type: interaction.interaction_type === 'like' ? 'liked' : 'shared',
          timestamp: interaction.created_at,
          platform: interaction.platform || undefined,
          imageData: {
            id: imageData.id,
            filename: imageData.filename,
            public_url: imageData.public_url,
            prompt_text: imageData.prompt_text,
            description: imageData.description,
            tags: imageData.tags || [],
            breed_id: imageData.breed_id,
            theme_id: imageData.theme_id,
            style_id: imageData.style_id,
            format_id: imageData.format_id,
            rating: imageData.rating,
            is_featured: imageData.is_featured,
            created_at: imageData.created_at,
            breed: imageData.breeds ? {
              id: imageData.breeds.id,
              name: imageData.breeds.name
            } : undefined,
            theme: imageData.themes ? {
              id: imageData.themes.id,
              name: imageData.themes.name
            } : undefined,
            style: imageData.styles ? {
              id: imageData.styles.id,
              name: imageData.styles.name
            } : undefined
          },
          // Gallery format compatibility
          interaction_type: interaction.interaction_type === 'like' ? 'liked' : 'shared',
          interaction_date: interaction.created_at
        };
      })
      .filter(Boolean) || [];

    console.log('Returning', combinedData.length, 'combined interactions');

    return NextResponse.json(combinedData);

  } catch (error) {
    console.error('Error in user-interactions API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}