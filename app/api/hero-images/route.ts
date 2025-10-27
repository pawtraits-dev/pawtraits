import { NextRequest, NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';

// Force dynamic rendering to avoid build-time Cloudinary configuration issues
export const dynamic = 'force-dynamic';

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

    // Get images from the pawtraits/heros folder or root level with hero in the name
    const result = await cloudinary.api.resources({
      type: 'upload',
      prefix: '', // Search all images
      resource_type: 'image',
      max_results: 100, // Get more to filter
      sort_by: [['created_at', 'desc']] // Newest first
    });

    // Filter for hero images (either in pawtraits/heros/ folder or containing 'hero' in the name)
    result.resources = result.resources.filter((resource: any) => 
      resource.public_id.startsWith('pawtraits/heros/') || 
      resource.public_id.includes('hero')
    ).slice(0, 20);

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