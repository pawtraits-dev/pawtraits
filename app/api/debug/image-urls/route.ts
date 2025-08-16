import { NextRequest, NextResponse } from 'next/server';
import { createGelatoService } from '@/lib/gelato-service';

export async function GET(request: NextRequest) {
  try {
    const gelatoService = createGelatoService();
    
    // Test with the actual image ID from the failed order
    const testImageId = 'da531428-e4e1-4f79-a7de-9c9185315dff';
    const testWidth = 20;
    const testHeight = 20;
    
    console.log('🖼️ Testing image URL generation...');
    
    // Generate the same URL that would be sent to Gelato
    const generatedUrl = gelatoService.generatePrintImageUrl(testImageId, testWidth, testHeight);
    
    // Test if the URL is accessible
    let urlAccessible = false;
    let urlError = null;
    
    try {
      const response = await fetch(generatedUrl, { method: 'HEAD' });
      urlAccessible = response.ok;
      if (!response.ok) {
        urlError = `HTTP ${response.status} ${response.statusText}`;
      }
    } catch (error) {
      urlError = error instanceof Error ? error.message : 'Network error';
    }
    
    const result = {
      timestamp: new Date().toISOString(),
      test_image_id: testImageId,
      dimensions: { width: testWidth, height: testHeight },
      cloudinary_configured: !!process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
      cloudinary_cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'not_set',
      generated_url: generatedUrl,
      url_accessible: urlAccessible,
      url_error: urlError,
      url_validation: {
        is_valid_url: generatedUrl.startsWith('http'),
        has_domain: generatedUrl.includes('://'),
        is_relative: generatedUrl.startsWith('/'),
        length: generatedUrl.length
      }
    };
    
    console.log('🖼️ Image URL test result:', result);
    
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('💥 Image URL test error:', error);
    return NextResponse.json(
      { 
        error: 'Image URL test failed', 
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}