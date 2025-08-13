import { NextRequest, NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST(request: NextRequest) {
  try {
    const { breed, theme, style, folder, tags } = await request.json();
    
    // Generate timestamp for the signature
    const timestamp = Math.round(Date.now() / 1000);
    
    // Create URL-safe folder name (replace spaces with underscores, remove special chars)
    const safeBreed = (breed || 'unknown').replace(/[^a-zA-Z0-9-]/g, '_');
    const safeTheme = (theme || 'portrait').replace(/[^a-zA-Z0-9-]/g, '_');
    const uploadFolder = folder || `pawtraits/${safeBreed}/${safeTheme}`;
    
    // Create safe tags array (no special characters that break signature)
    const safeTags = tags ? tags.map(tag => tag.replace(/[^a-zA-Z0-9-]/g, '_')) : [];
    
    // Build upload parameters that will be signed (only include essential params for signature)
    const uploadParams = {
      timestamp,
      folder: uploadFolder,
      resource_type: 'image',
      // Remove problematic parameters that might break signature
      // quality and format will be applied after upload via transformations
    };
    
    // Add tags only if they exist and are safe
    if (safeTags.length > 0) {
      uploadParams.tags = safeTags.join(',');
    }
    
    // Remove undefined values
    const cleanParams = Object.fromEntries(
      Object.entries(uploadParams).filter(([_, value]) => value !== undefined)
    );
    
    // Generate signature using Cloudinary's utils
    const signature = cloudinary.utils.api_sign_request(
      cleanParams,
      process.env.CLOUDINARY_API_SECRET!
    );
    
    console.log('🔐 Generated signed upload parameters:', {
      folder: uploadFolder,
      timestamp,
      tags: safeTags.join(','),
      hasSignature: !!signature,
      originalBreed: breed,
      safeBreed: safeBreed
    });
    
    return NextResponse.json({
      signature,
      timestamp,
      api_key: process.env.CLOUDINARY_API_KEY!,
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
      folder: uploadFolder,
      tags: safeTags.join(','),
      resource_type: 'image'
    });
    
  } catch (error) {
    console.error('❌ Failed to generate signed upload parameters:', error);
    return NextResponse.json(
      { error: 'Failed to generate upload signature' },
      { status: 500 }
    );
  }
}