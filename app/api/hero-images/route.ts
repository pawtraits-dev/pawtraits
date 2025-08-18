import { NextRequest, NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary
function ensureCloudinaryConfig() {
  const cloudinaryConfig = {
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  };

  if (!cloudinaryConfig.cloud_name || !cloudinaryConfig.api_key || !cloudinaryConfig.api_secret) {
    throw new Error('Cloudinary configuration is incomplete. Check your environment variables.');
  }

  cloudinary.config(cloudinaryConfig);
  return cloudinaryConfig;
}

export async function GET() {
  try {
    // Ensure Cloudinary is configured
    ensureCloudinaryConfig();

    // Get images from the pawtraits/heros folder
    const result = await cloudinary.api.resources({
      type: 'upload',
      prefix: 'pawtraits/heros/',
      resource_type: 'image',
      max_results: 20, // Limit to 20 hero images
      sort_by: [['created_at', 'desc']] // Newest first
    });

    // Transform the results to provide optimized URLs for hero display
    const heroImages = result.resources.map((resource: any) => ({
      public_id: resource.public_id,
      url: cloudinary.url(resource.public_id, {
        width: 1920,
        height: 800,
        crop: 'fill',
        quality: 'auto:good',
        format: 'auto',
        gravity: 'center'
      }),
      thumbnail: cloudinary.url(resource.public_id, {
        width: 400,
        height: 200,
        crop: 'fill',
        quality: 'auto:good',
        format: 'auto',
        gravity: 'center'
      }),
      alt: resource.context?.alt || `Hero image ${resource.public_id.split('/').pop()}`,
      created_at: resource.created_at
    }));

    return NextResponse.json({
      images: heroImages,
      total: result.resources.length
    });

  } catch (error) {
    console.error('Error fetching hero images:', error);
    return NextResponse.json(
      { error: 'Failed to fetch hero images' },
      { status: 500 }
    );
  }
}