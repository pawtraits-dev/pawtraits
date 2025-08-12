import { SupabaseService } from '@/lib/supabase';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabaseService = new SupabaseService();
    
    // Check total images
    const { data: allImages, error: allError } = await supabaseService.getClient()
      .from('image_catalog')
      .select('id, is_public, created_at')
      .order('created_at', { ascending: false });
    
    if (allError) {
      console.error('Error getting all images:', allError);
    }
    
    // Check public images
    const { data: publicImages, error: publicError } = await supabaseService.getClient()
      .from('image_catalog')
      .select('id, is_public, created_at')
      .eq('is_public', true)
      .order('created_at', { ascending: false });
    
    if (publicError) {
      console.error('Error getting public images:', publicError);
    }
    
    // Test the service method
    let serviceImages = [];
    let serviceError = null;
    try {
      serviceImages = await supabaseService.getImages({
        limit: 10,
        publicOnly: true
      });
    } catch (err: any) {
      serviceError = err.message;
    }
    
    return NextResponse.json({
      totalImages: allImages?.length || 0,
      publicImages: publicImages?.length || 0,
      serviceImages: serviceImages.length,
      serviceError,
      sampleAllImages: allImages?.slice(0, 3) || [],
      samplePublicImages: publicImages?.slice(0, 3) || [],
      sampleServiceImages: serviceImages.slice(0, 3)
    });
    
  } catch (error: any) {
    console.error('Debug images error:', error);
    return NextResponse.json({
      error: error.message,
      stack: error.stack?.substring(0, 500)
    }, { status: 500 });
  }
}