import { SupabaseService } from '@/lib/supabase';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabaseService = new SupabaseService();
    
    // Get formats
    const formats = await supabaseService.getFormats();
    
    // Get products using regular service (should have public read access)
    const products = await supabaseService.getProducts();
    
    // Get pricing using regular service
    const pricing = await supabaseService.getAllProductPricing();
    
    // Check specific format from the images
    const portraitFormatId = "9c601643-9788-4558-b38d-b17e9a22a6cb";
    const portraitProducts = products?.filter(p => 
      p.is_active && p.format_id === portraitFormatId
    ) || [];
    
    const portraitPricing = pricing?.filter(p => 
      p.country_code === 'GB' && 
      portraitProducts.some(product => product.id === p.product_id)
    ) || [];
    
    return NextResponse.json({
      totalFormats: formats?.length || 0,
      totalProducts: products?.length || 0,
      activeProducts: products?.filter(p => p.is_active)?.length || 0,
      totalPricing: pricing?.length || 0,
      gbPricing: pricing?.filter(p => p.country_code === 'GB')?.length || 0,
      
      portraitFormat: formats?.find(f => f.id === portraitFormatId),
      portraitProducts: portraitProducts.length,
      portraitPricing: portraitPricing.length,
      
      sampleFormats: formats?.slice(0, 3) || [],
      sampleProducts: products?.slice(0, 3) || [],
      samplePricing: pricing?.slice(0, 3) || [],
      samplePortraitProducts: portraitProducts.slice(0, 2),
      samplePortraitPricing: portraitPricing.slice(0, 2)
    });
    
  } catch (error: any) {
    console.error('Debug products error:', error);
    return NextResponse.json({
      error: error.message,
      stack: error.stack?.substring(0, 500)
    }, { status: 500 });
  }
}