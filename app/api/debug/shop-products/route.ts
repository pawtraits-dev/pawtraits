import { SupabaseService } from '@/lib/supabase';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabaseService = new SupabaseService();
    
    // Test the exact same calls that customer shop makes
    const [formats, products, pricing] = await Promise.all([
      supabaseService.getFormats(),
      supabaseService.getProducts(),
      supabaseService.getAllProductPricing()
    ]);
    
    // Check the Portrait format specifically (from image data)
    const portraitFormatId = "9c601643-9788-4558-b38d-b17e9a22a6cb";
    const portraitFormat = formats?.find(f => f.id === portraitFormatId);
    
    const portraitProducts = products?.filter(p => 
      p.is_active && p.format_id === portraitFormatId
    ) || [];
    
    const portraitPricing = pricing?.filter(p => 
      p.country_code === 'GB' && 
      portraitProducts.some(product => product.id === p.product_id)
    ) || [];
    
    // Test the exact product info logic from customer shop
    const sampleImageId = "f32d511e-c8f0-45bf-88bd-6b198b50326b"; // From image debug
    const sampleImage = {
      id: sampleImageId,
      format_id: portraitFormatId
    };
    
    // Mimic getImageProductInfo logic
    const availableProducts = products?.filter(p => 
      p.is_active && p.format_id === sampleImage.format_id
    ) || [];
    
    const gbPricing = pricing?.filter(p => 
      p.country_code === 'GB' && 
      availableProducts.some(product => product.id === p.product_id)
    ) || [];
    
    const productInfo = {
      productCount: availableProducts.length,
      lowestPrice: gbPricing.length > 0 ? 
        gbPricing.reduce((lowest, current) => 
          current.sale_price < lowest.sale_price ? current : lowest
        ).sale_price : null,
      currency: gbPricing.length > 0 ? gbPricing[0].currency_code : null
    };
    
    return NextResponse.json({
      summary: {
        totalFormats: formats?.length || 0,
        totalProducts: products?.length || 0,
        activeProducts: products?.filter(p => p.is_active)?.length || 0,
        totalPricing: pricing?.length || 0,
        gbPricing: pricing?.filter(p => p.country_code === 'GB')?.length || 0
      },
      portraitFormat: portraitFormat,
      portraitProducts: portraitProducts.length,
      portraitPricing: portraitPricing.length,
      sampleImageProductInfo: productInfo,
      debug: {
        sampleProducts: portraitProducts.slice(0, 2),
        samplePricing: portraitPricing.slice(0, 2),
        availableProductsForSample: availableProducts.length,
        gbPricingForSample: gbPricing.length
      }
    });
    
  } catch (error: any) {
    console.error('Debug shop products error:', error);
    return NextResponse.json({
      error: error.message,
      stack: error.stack?.substring(0, 500)
    }, { status: 500 });
  }
}