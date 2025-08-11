import { NextRequest, NextResponse } from 'next/server';
import { SupabaseService } from '@/lib/supabase';

const supabaseService = new SupabaseService();

export async function GET(request: NextRequest) {
  try {
    // TODO: Add admin authentication check
    
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // 'liked' or 'shared'
    
    console.log('Admin user interactions API: Fetching interaction data with server-side tracking...');
    
    // Get image catalog data with interaction stats
    const { data: images, error: imagesError } = await supabaseService['supabase']
      .from('popular_images_complete_analytics') // Use the corrected view name
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500); // Limit to recent images for performance

    if (imagesError) {
      console.error('Error fetching images:', imagesError);
      throw imagesError;
    }

    // Filter based on interaction type if specified
    let filteredImages = images || [];
    
    if (type === 'liked') {
      // Show images with likes (like_count > 0) or all images with like counts
      filteredImages = filteredImages.map((image: any) => ({
        ...image,
        like_count: image.current_like_count,
        share_count: image.legacy_share_count,
        view_count: image.current_view_count,
        unique_users: image.detailed_unique_users,
        interaction_summary: `${image.current_like_count || 0} likes from ${image.detailed_unique_users || 0} users`
      }));
    } else if (type === 'shared') {
      // Show images with shares (share_count > 0) or all images with share counts  
      filteredImages = filteredImages.map((image: any) => ({
        ...image,
        like_count: image.current_like_count,
        share_count: image.legacy_share_count,
        view_count: image.current_view_count,
        unique_users: image.detailed_unique_users,
        interaction_summary: `${image.legacy_share_count || 0} shares from ${image.detailed_unique_users || 0} users`
      }));
    } else {
      // Show all images with general interaction summary
      filteredImages = filteredImages.map((image: any) => ({
        ...image,
        like_count: image.current_like_count,
        share_count: image.legacy_share_count,
        view_count: image.current_view_count,
        unique_users: image.detailed_unique_users,
        interaction_summary: `${image.current_like_count || 0} likes, ${image.legacy_share_count || 0} shares, ${image.current_view_count || 0} views`
      }));
    }

    // Sort by interaction count based on type
    if (type === 'liked') {
      filteredImages.sort((a: any, b: any) => (b.like_count || 0) - (a.like_count || 0));
    } else if (type === 'shared') {
      filteredImages.sort((a: any, b: any) => (b.share_count || 0) - (a.share_count || 0));
    } else {
      // Sort by total interactions (likes + shares + views)
      filteredImages.sort((a: any, b: any) => {
        const aTotal = (a.like_count || 0) + (a.share_count || 0) + (a.view_count || 0);
        const bTotal = (b.like_count || 0) + (b.share_count || 0) + (b.view_count || 0);
        return bTotal - aTotal;
      });
    }

    const response = {
      images: filteredImages,
      total_images: filteredImages.length,
      note: 'Server-side interaction tracking is now active! Real-time analytics available.',
      suggestion: 'Data is automatically updated when users interact with images. Check the interaction stats for detailed insights.'
    };

    console.log('Admin user interactions API: Processed', filteredImages.length, 'images with server-side data');
    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching user interactions for admin:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user interaction data' },
      { status: 500 }
    );
  }
}