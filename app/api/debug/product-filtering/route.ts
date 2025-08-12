import { SupabaseService } from '@/lib/supabase';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabaseService = new SupabaseService();
    
    // Get the exact same data that shop pages use
    const [images, products, pricing] = await Promise.all([
      supabaseService.getImages({
        limit: 10,
        publicOnly: true
      }),
      supabaseService.getProducts(),
      supabaseService.getAllProductPricing()
    ]);
    
    // Test the product filtering logic for each image
    const imageAnalysis = images.map(image => {
      // Replicate the getImageProductInfo logic
      const availableProducts = products?.filter(p => 
        p.is_active && p.format_id === image.format_id
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
      
      return {
        imageId: image.id,
        formatId: image.format_id,
        formatName: image.format_name,
        productInfo,
        matchingProducts: availableProducts.map(p => ({
          id: p.id,
          name: p.name,
          isActive: p.is_active,
          formatId: p.format_id
        })),
        matchingPricing: gbPricing.map(p => ({
          productId: p.product_id,
          salePrice: p.sale_price,
          currency: p.currency_code
        })),
        wouldShow: productInfo.productCount > 0
      };
    });
    
    return NextResponse.json({
      summary: {
        totalImages: images.length,
        totalProducts: products?.length || 0,
        totalPricing: pricing?.length || 0,
        imagesWithProducts: imageAnalysis.filter(img => img.wouldShow).length,
        imagesWithoutProducts: imageAnalysis.filter(img => !img.wouldShow).length
      },
      imageAnalysis,
      availableFormats: [...new Set(images.map(img => img.format_id))],
      productFormats: [...new Set((products || []).map(p => p.format_id))],
      formatMismatch: {
        imageFormats: [...new Set(images.map(img => ({ id: img.format_id, name: img.format_name })))],
        productFormats: [...new Set((products || []).filter(p => p.is_active).map(p => ({ 
          id: p.format_id, 
          name: p.name,
          sku: p.sku
        })))]
      }
    });
    
  } catch (error: any) {
    console.error('Debug product filtering error:', error);
    return NextResponse.json({
      error: error.message,
      stack: error.stack?.substring(0, 500)
    }, { status: 500 });
  }
}