import { NextRequest, NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';

// Force dynamic rendering to avoid build-time Cloudinary configuration issues
export const dynamic = 'force-dynamic';

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
    
    // Use the existing Cloudinary folder structure from lib/cloudinary.ts
    const uploadFolder = folder || 'pawtraits/originals';
    
    // Create safe tags array (only alphanumeric characters to prevent signature issues)
    const safeTags = tags ? tags.map(tag => tag.replace(/[^a-zA-Z0-9]/g, '_')) : [];
    
    // Build upload parameters that will be signed (only params Cloudinary validates)
    const uploadParams = {
      timestamp,
      folder: uploadFolder,
      type: 'upload' // CRITICAL: Must be 'upload' (public) not 'authenticated' for Gelato compatibility
      // resource_type is NOT included in Cloudinary's signature validation
      // Only include parameters that Cloudinary actually validates in signatures
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
      type: 'upload', // CRITICAL: Client must use type='upload' for public URLs (Gelato compatibility)
      resource_type: 'image' // Client needs this but it's NOT part of signature
    });
    
  } catch (error) {
    console.error('❌ Failed to generate signed upload parameters:', error);
    return NextResponse.json(
      { error: 'Failed to generate upload signature' },
      { status: 500 }
    );
  }
}