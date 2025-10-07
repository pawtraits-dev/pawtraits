import { NextRequest, NextResponse } from 'next/server';
import { cloudinaryService } from '@/lib/cloudinary';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Test with a real image ID from the catalog
    const testImageId = 'da531428-e4e1-4f79-a7de-9c9185315dff';
    
    console.log('🧪 Testing Cloudinary original print URL generation...');
    
    // Get image data from database
    const { data: imageData, error: imageError } = await supabase
      .from('image_catalog')
      .select('cloudinary_public_id, public_url, original_filename')
      .eq('id', testImageId)
      .single();

    if (imageError || !imageData) {
      console.error('❌ Failed to get image data:', imageError);
      return NextResponse.json({
        error: 'Image not found in catalog',
        imageId: testImageId,
        timestamp: new Date().toISOString()
      });
    }

    console.log('📷 Image data:', imageData);

    let results: any = {
      timestamp: new Date().toISOString(),
      test_image_id: testImageId,
      image_data: {
        cloudinary_public_id: imageData.cloudinary_public_id,
        has_public_url: !!imageData.public_url,
        original_filename: imageData.original_filename
      }
    };

    if (imageData.cloudinary_public_id) {
      try {
        // Test the Cloudinary original print URL generation
        const printUrl = await cloudinaryService.getOriginalPrintUrl(
          imageData.cloudinary_public_id, 
          'test-order-123'
        );
        
        results.cloudinary_test = {
          generated_url: printUrl,
          url_length: printUrl.length,
          is_https: printUrl.startsWith('https://'),
          is_cloudinary: printUrl.includes('cloudinary.com'),
          has_auth_token: printUrl.includes('auth_token')
        };

        // Test if the URL is accessible
        try {
          const response = await fetch(printUrl, { method: 'HEAD' });
          results.cloudinary_test.url_accessible = response.ok;
          results.cloudinary_test.status_code = response.status;
          results.cloudinary_test.status_text = response.statusText;
        } catch (fetchError) {
          results.cloudinary_test.url_accessible = false;
          results.cloudinary_test.fetch_error = fetchError instanceof Error ? fetchError.message : 'Unknown error';
        }

      } catch (cloudinaryError) {
        results.cloudinary_error = {
          message: cloudinaryError instanceof Error ? cloudinaryError.message : 'Unknown error',
          type: 'cloudinary_generation_failed'
        };
      }
    } else {
      results.cloudinary_test = {
        error: 'No cloudinary_public_id found in database'
      };
    }

    console.log('🧪 Cloudinary test results:', results);
    return NextResponse.json(results);

  } catch (error) {
    console.error('💥 Cloudinary test error:', error);
    return NextResponse.json(
      { 
        error: 'Cloudinary test failed', 
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}