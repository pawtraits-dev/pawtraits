import { NextRequest, NextResponse } from 'next/server';
import { SupabaseService } from '@/lib/supabase';
import { cloudinaryService } from '@/lib/cloudinary';

const supabaseService = new SupabaseService();

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const imageId = params.id;
    
    // Get current user to validate purchase
    const { data: { user } } = await supabaseService.getClient().auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    console.log(`🔄 Download request for image ${imageId} by user ${user.id}`);

    // Get image details
    const image = await supabaseService.getImage(imageId);
    if (!image) {
      return NextResponse.json(
        { error: 'Image not found' },
        { status: 404 }
      );
    }

    // Check if user has purchased this image via user_interactions table
    const { data: interaction, error: interactionError } = await supabaseService.getClient()
      .from('user_interactions')
      .select('*')
      .eq('user_id', user.id)
      .eq('image_id', imageId)
      .eq('interaction_type', 'purchased')
      .single();

    if (interactionError || !interaction) {
      console.log(`❌ User ${user.id} has not purchased image ${imageId}`);
      return NextResponse.json(
        { error: 'Image not purchased. Purchase required to download.' },
        { status: 403 }
      );
    }

    console.log(`✅ User ${user.id} has purchased image ${imageId}`);

    // Generate purchased variant URL (full quality with brand overlay in lower right)
    if (!image.cloudinary_public_id) {
      // Fallback to original URL for non-Cloudinary images
      console.log(`⚠️ Image ${imageId} has no Cloudinary public ID, using fallback`);
      return NextResponse.json({
        download_url: image.public_url,
        variant: 'original',
        filename: image.original_filename
      });
    }

    const downloadUrl = cloudinaryService.getPublicVariantUrl(
      image.cloudinary_public_id,
      'purchased'
    );

    console.log(`📥 Generated download URL for purchased image: ${downloadUrl}`);

    return NextResponse.json({
      download_url: downloadUrl,
      variant: 'purchased',
      filename: image.original_filename,
      cloudinary_public_id: image.cloudinary_public_id
    });

  } catch (error) {
    console.error('❌ Download URL generation failed:', error);
    return NextResponse.json(
      { 
        error: 'Failed to generate download URL',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}