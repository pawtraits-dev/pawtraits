import { NextRequest, NextResponse } from 'next/server';
import { cloudinaryService } from '@/lib/cloudinary';

export async function POST(request: NextRequest) {
  try {
    const { publicId, variant } = await request.json();
    
    if (!publicId || !variant) {
      return NextResponse.json(
        { error: 'Missing publicId or variant parameter' },
        { status: 400 }
      );
    }
    
    console.log(`🧪 Testing Cloudinary variant: ${variant} for publicId: ${publicId}`);
    
    let url: string;
    
    switch (variant) {
      case 'full_size':
      case 'mid_size':
      case 'thumbnail':
      case 'purchased':
        url = cloudinaryService.getPublicVariantUrl(publicId, variant);
        break;
        
      case 'original':
        // Return direct Cloudinary URL without transformations
        url = `https://res.cloudinary.com/dnhzfz8xv/image/upload/${publicId}`;
        break;
        
      default:
        return NextResponse.json(
          { error: `Unknown variant: ${variant}` },
          { status: 400 }
        );
    }
    
    console.log(`✅ Generated ${variant} URL: ${url}`);
    
    return NextResponse.json({
      publicId,
      variant,
      url,
      timestamp: Date.now()
    });
    
  } catch (error) {
    console.error('❌ Cloudinary variant test failed:', error);
    return NextResponse.json(
      { 
        error: 'Variant test failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}