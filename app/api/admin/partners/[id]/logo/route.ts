import { NextRequest, NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';
import { AdminSupabaseService } from '@/lib/admin-supabase';

// Configure Cloudinary
if (!cloudinary.config().cloud_name) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // TODO: Add admin authentication check
    const adminService = new AdminSupabaseService();

    const partnerId = params.id;
    if (!partnerId) {
      return NextResponse.json(
        { error: 'Partner ID is required' },
        { status: 400 }
      );
    }

    // Verify partner exists
    const partner = await adminService.getPartner(partnerId);
    if (!partner) {
      return NextResponse.json(
        { error: 'Partner not found' },
        { status: 404 }
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
        tags: ['partner-logo', `partner-${partnerId}`, 'admin-uploaded'],
        resource_type: 'image',
        public_id: `partner-logo-${partnerId}-${Date.now()}`,
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

    // Update partner record with logo URL using admin service
    const updatedPartner = await adminService.updatePartner(partnerId, {
      logo_url: result.secure_url
    });

    console.log(`✅ Admin uploaded partner logo for partner ${partnerId}`);
    console.log(`   Cloudinary URL: ${result.secure_url}`);
    console.log(`   File size: ${(result.bytes / 1024 / 1024).toFixed(2)}MB`);
    console.log(`   Dimensions: ${result.width}x${result.height}px`);

    return NextResponse.json({
      success: true,
      logo_url: result.secure_url,
      partner: updatedPartner
    });

  } catch (error) {
    console.error('Admin partner logo upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload logo' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // TODO: Add admin authentication check
    const adminService = new AdminSupabaseService();

    const partnerId = params.id;
    if (!partnerId) {
      return NextResponse.json(
        { error: 'Partner ID is required' },
        { status: 400 }
      );
    }

    // Verify partner exists and get current logo
    const partner = await adminService.getPartner(partnerId);
    if (!partner) {
      return NextResponse.json(
        { error: 'Partner not found' },
        { status: 404 }
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
      console.log(`🗑️ Admin deleted logo from Cloudinary: ${publicId}`);
    } catch (cloudinaryError) {
      console.error('Failed to delete from Cloudinary:', cloudinaryError);
      // Continue with database update even if Cloudinary deletion fails
    }

    // Remove logo URL from partner record using admin service
    const updatedPartner = await adminService.updatePartner(partnerId, {
      logo_url: null
    });

    console.log(`✅ Admin removed partner logo for partner ${partnerId}`);

    return NextResponse.json({
      success: true,
      partner: updatedPartner
    });

  } catch (error) {
    console.error('Admin partner logo deletion error:', error);
    return NextResponse.json(
      { error: 'Failed to delete logo' },
      { status: 500 }
    );
  }
}