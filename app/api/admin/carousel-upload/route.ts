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

export async function POST(request: NextRequest) {
  try {
    // Ensure Cloudinary is configured
    ensureCloudinaryConfig();

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const pageType = formData.get('pageType') as string;
    const slideName = formData.get('slideName') as string;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Create a unique filename
    const timestamp = Date.now();
    const safeName = (slideName || file.name)
      .replace(/[^a-zA-Z0-9]/g, '_')
      .toLowerCase();
    const fileName = `${safeName}_${timestamp}`;

    // Upload to Cloudinary in the carousels folder
    const uploadResult = await cloudinary.uploader.upload(
      `data:${file.type};base64,${buffer.toString('base64')}`,
      {
        public_id: `pawtraits/carousels/${pageType}/${fileName}`,
        folder: `pawtraits/carousels/${pageType}`,
        resource_type: 'image',
        quality: 'auto:good',
        overwrite: false,
        unique_filename: true,
        tags: ['carousel', pageType, 'admin-upload']
      }
    );

    // Generate optimized URLs for different use cases
    const optimizedUrls = {
      // Hero display URL (1920x800, optimized)
      hero: cloudinary.url(uploadResult.public_id, {
        width: 1920,
        height: 800,
        crop: 'fill',
        quality: 'auto:good',
        gravity: 'center'
      }),
      // Thumbnail URL (400x200, optimized)
      thumbnail: cloudinary.url(uploadResult.public_id, {
        width: 400,
        height: 200,
        crop: 'fill',
        quality: 'auto:good',
        gravity: 'center'
      }),
      // Original secure URL
      original: uploadResult.secure_url
    };

    const response = {
      success: true,
      data: {
        public_id: uploadResult.public_id,
        secure_url: uploadResult.secure_url,
        url: optimizedUrls.hero,
        thumbnail_url: optimizedUrls.thumbnail,
        width: uploadResult.width,
        height: uploadResult.height,
        format: uploadResult.format,
        resource_type: uploadResult.resource_type,
        created_at: uploadResult.created_at,
        urls: optimizedUrls
      }
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Carousel image upload failed:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed' 
      },
      { status: 500 }
    );
  }
}