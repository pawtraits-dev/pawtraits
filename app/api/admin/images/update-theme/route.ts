import { NextRequest, NextResponse } from 'next/server';
import { SupabaseService } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { imageIds, newThemeId } = await request.json();

    if (!imageIds || !Array.isArray(imageIds) || imageIds.length === 0) {
      return NextResponse.json(
        { error: 'imageIds array is required' },
        { status: 400 }
      );
    }

    if (!newThemeId) {
      return NextResponse.json(
        { error: 'newThemeId is required' },
        { status: 400 }
      );
    }

    const supabaseService = new SupabaseService();
    
    // Verify user is admin
    const user = await supabaseService.getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const profile = await supabaseService.getCurrentUserProfile();
    if (!profile || profile.user_type !== 'admin') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    // Update the theme_id for all specified images
    const { data, error } = await supabaseService.supabase
      .from('image_catalog')
      .update({ 
        theme_id: newThemeId,
        updated_at: new Date().toISOString()
      })
      .in('id', imageIds)
      .select('id, theme_id');

    if (error) {
      console.error('Error updating image themes:', error);
      return NextResponse.json(
        { error: 'Failed to update image themes' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      updatedCount: data?.length || 0,
      message: `Successfully updated theme for ${data?.length || 0} images`
    });

  } catch (error) {
    console.error('Error in update-theme route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}