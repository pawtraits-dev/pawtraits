import { NextRequest, NextResponse } from 'next/server';
import { SupabaseService } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const supabaseService = new SupabaseService();

    // Get the authenticated user
    const { data: { user }, error: authError } = await supabaseService.getClient().auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    console.log('Fetching user interactions for user:', user.id);

    // Fetch user interactions from the database
    const { data: interactions, error: interactionsError } = await supabaseService
      .getClient()
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
      console.error('Error fetching user interactions:', interactionsError);
      return NextResponse.json(
        { error: 'Failed to fetch user interactions' },
        { status: 500 }
      );
    }

    console.log('Found', interactions?.length || 0, 'user interactions');

    // Now fetch the image data for these interactions
    const imageIds = [...new Set(interactions?.map(i => i.image_id) || [])];

    if (imageIds.length === 0) {
      return NextResponse.json([]);
    }

    console.log('Fetching image data for', imageIds.length, 'unique images');

    // Fetch image data from image_catalog
    const { data: images, error: imagesError } = await supabaseService
      .getClient()
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