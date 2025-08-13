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
    
    // Use the specified flat folder structure
    const uploadFolder = folder || 'home/pawtraits/originals';
    
    // Create safe tags array (only alphanumeric characters to prevent signature issues)
    const safeTags = tags ? tags.map(tag => tag.replace(/[^a-zA-Z0-9]/g, '_')) : [];
    
    // Build upload parameters that will be signed (minimal params to avoid signature issues)
    const uploadParams = {
      timestamp,
      folder: uploadFolder,
      resource_type: 'image'
      // Temporarily remove tags from signature to isolate signature issues
      // Tags will be added after successful upload via Cloudinary admin API
    };
    
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
      breed,
      theme,
      style
    });
    
    return NextResponse.json({
      signature,
      timestamp,
      api_key: process.env.CLOUDINARY_API_KEY!,
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
      folder: uploadFolder,
      resource_type: 'image'
      // Tags removed from direct upload - will be added via metadata in database
    });
    
  } catch (error) {
    console.error('❌ Failed to generate signed upload parameters:', error);
    return NextResponse.json(
      { error: 'Failed to generate upload signature' },
      { status: 500 }
    );
  }
}