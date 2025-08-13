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
    
    // Determine upload folder based on metadata
    const uploadFolder = folder || `pawtraits/${breed || 'unknown'}/${theme || 'portrait'}`;
    
    // Build upload parameters that will be signed
    const uploadParams = {
      timestamp,
      folder: uploadFolder,
      resource_type: 'image',
      quality: 'auto:best', // Preserve maximum quality
      format: 'png', // Use PNG to avoid JPEG compression artifacts
      tags: tags ? tags.join(',') : undefined,
      context: breed && theme ? `breed=${breed}|theme=${theme}|style=${style || 'professional'}` : undefined
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
      quality: 'auto:best',
      hasSignature: !!signature
    });
    
    return NextResponse.json({
      signature,
      timestamp,
      api_key: process.env.CLOUDINARY_API_KEY!,
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
      folder: uploadFolder,
      ...cleanParams
    });
    
  } catch (error) {
    console.error('❌ Failed to generate signed upload parameters:', error);
    return NextResponse.json(
      { error: 'Failed to generate upload signature' },
      { status: 500 }
    );
  }
}