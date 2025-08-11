import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '8');
    
    // Get popular images based on combined popularity score
    // Score = (likes * 3) + (shares * 5) + (views * 1) + (purchases * 10)
    // This weights purchases highest, shares next, then likes, then views
    const { data: popularImages, error } = await supabase
      .from('image_catalog')
      .select(`
        *,
        breeds!breed_id (
          id,
          name,
          animal_type
        ),
        themes!theme_id (
          id,
          name
        ),
        styles!style_id (
          id,
          name
        ),
        formats!format_id (
          id,
          name
        ),
        coats!coat_id (
          id,
          name,
          hex_color,
          animal_type
        )
      `)
      .eq('is_public', true)
      .order('created_at', { ascending: false }); // Fallback ordering

    if (error) {
      console.error('Error fetching images for popularity calculation:', error);
      return NextResponse.json({ error: 'Failed to fetch images' }, { status: 500 });
    }

    if (!popularImages || popularImages.length === 0) {
      return NextResponse.json([]);
    }

    // Get interaction analytics for all images
    const imageIds = popularImages.map(img => img.id);
    const { data: analytics } = await supabase
      .from('interaction_analytics')
      .select('image_id, total_likes, total_shares, total_views')
      .in('image_id', imageIds);

    // Get purchase counts for all images
    const { data: purchases } = await supabase
      .from('order_items')
      .select('image_id')
      .in('image_id', imageIds);

    // Calculate purchase counts per image
    const purchaseCounts = purchases?.reduce((acc: { [key: string]: number }, item) => {
      acc[item.image_id] = (acc[item.image_id] || 0) + 1;
      return acc;
    }, {}) || {};

    // Create analytics lookup map
    const analyticsMap = analytics?.reduce((acc: { [key: string]: any }, item) => {
      acc[item.image_id] = item;
      return acc;
    }, {}) || {};

    // Calculate popularity scores and add analytics data
    const imagesWithPopularity = popularImages.map(image => {
      const imageAnalytics = analyticsMap[image.id] || { total_likes: 0, total_shares: 0, total_views: 0 };
      const purchaseCount = purchaseCounts[image.id] || 0;
      
      // Popularity score calculation
      const likes = imageAnalytics.total_likes || 0;
      const shares = imageAnalytics.total_shares || 0;
      const views = imageAnalytics.total_views || 0;
      
      const popularityScore = (likes * 3) + (shares * 5) + (views * 1) + (purchaseCount * 10);
      
      return {
        ...image,
        // Add flattened breed/theme/style data for compatibility
        breed_name: image.breeds?.name,
        breed_animal_type: image.breeds?.animal_type,
        theme_name: image.themes?.name,
        style_name: image.styles?.name,
        format_name: image.formats?.name,
        coat_name: image.coats?.name,
        coat_hex_color: image.coats?.hex_color,
        coat_animal_type: image.coats?.animal_type,
        // Add popularity metrics
        like_count: likes,
        share_count: shares,
        view_count: views,
        purchase_count: purchaseCount,
        popularity_score: popularityScore
      };
    });

    // Sort by popularity score (descending), then by creation date for tiebreakers
    const sortedImages = imagesWithPopularity.sort((a, b) => {
      if (b.popularity_score !== a.popularity_score) {
        return b.popularity_score - a.popularity_score;
      }
      // If same popularity score, sort by newest first
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    // Return top results
    const result = sortedImages.slice(0, limit);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in popular images API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}