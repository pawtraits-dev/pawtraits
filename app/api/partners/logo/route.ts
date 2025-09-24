import { NextRequest, NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';
import { SupabaseService } from '@/lib/supabase';

// Configure Cloudinary
if (!cloudinary.config().cloud_name) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

export async function POST(request: NextRequest) {
  try {
    const supabaseService = new SupabaseService();
    const { data: { user } } = await supabaseService.getClient().auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get partner profile to verify user is a partner
    const partner = await supabaseService.getCurrentPartner();
    if (!partner) {
      return NextResponse.json(
        { error: 'Partner profile required' },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('logo') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'Logo file is required' },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload a JPEG, PNG, or WebP image.' },
        { status: 400 }
      );
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 5MB.' },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Upload to Cloudinary with partner-specific folder and optimizations
    const result = await cloudinary.uploader.upload(
      `data:${file.type};base64,${buffer.toString('base64')}`,
      {
        folder: 'pawtraits/partner-logos',
        tags: ['partner-logo', `partner-${partner.id}`],
        resource_type: 'image',
        public_id: `partner-logo-${partner.id}-${Date.now()}`,
        overwrite: true, // Allow overwriting previous logo
        invalidate: true,
        transformation: [
          {
            width: 400,
            height: 400,
            crop: 'limit',
            quality: 'auto:good',
            format: 'auto'
          }
        ]
      }
    );

    // Update partner record with logo URL
    const { data: updatedPartner, error: updateError } = await supabaseService
      .getClient()
      .from('partners')
      .update({ logo_url: result.secure_url })
      .eq('id', partner.id)
      .select()
      .single();

    if (updateError) {
      console.error('Failed to update partner logo URL:', updateError);
      return NextResponse.json(
        { error: 'Failed to save logo to profile' },
        { status: 500 }
      );
    }

    console.log(`✅ Partner logo uploaded successfully for partner ${partner.id}`);
    console.log(`   Cloudinary URL: ${result.secure_url}`);
    console.log(`   File size: ${(result.bytes / 1024 / 1024).toFixed(2)}MB`);
    console.log(`   Dimensions: ${result.width}x${result.height}px`);

    return NextResponse.json({
      success: true,
      logo_url: result.secure_url,
      partner: updatedPartner
    });

  } catch (error) {
    console.error('Partner logo upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload logo' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabaseService = new SupabaseService();
    const { data: { user } } = await supabaseService.getClient().auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get partner profile to verify user is a partner
    const partner = await supabaseService.getCurrentPartner();
    if (!partner) {
      return NextResponse.json(
        { error: 'Partner profile required' },
        { status: 403 }
      );
    }

    if (!partner.logo_url) {
      return NextResponse.json(
        { error: 'No logo to delete' },
        { status: 400 }
      );
    }

    // Extract public_id from Cloudinary URL to delete the image
    try {
      const urlParts = partner.logo_url.split('/');
      const publicIdWithExtension = urlParts.slice(-2).join('/'); // Get folder/filename
      const publicId = publicIdWithExtension.replace(/\.[^/.]+$/, ''); // Remove extension

      // Delete from Cloudinary
      await cloudinary.uploader.destroy(publicId);
      console.log(`🗑️ Deleted logo from Cloudinary: ${publicId}`);
    } catch (cloudinaryError) {
      console.error('Failed to delete from Cloudinary:', cloudinaryError);
      // Continue with database update even if Cloudinary deletion fails
    }

    // Remove logo URL from partner record
    const { data: updatedPartner, error: updateError } = await supabaseService
      .getClient()
      .from('partners')
      .update({ logo_url: null })
      .eq('id', partner.id)
      .select()
      .single();

    if (updateError) {
      console.error('Failed to remove partner logo URL:', updateError);
      return NextResponse.json(
        { error: 'Failed to remove logo from profile' },
        { status: 500 }
      );
    }

    console.log(`✅ Partner logo removed successfully for partner ${partner.id}`);

    return NextResponse.json({
      success: true,
      partner: updatedPartner
    });

  } catch (error) {
    console.error('Partner logo deletion error:', error);
    return NextResponse.json(
      { error: 'Failed to delete logo' },
      { status: 500 }
    );
  }
}