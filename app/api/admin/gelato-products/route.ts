import { NextRequest, NextResponse } from 'next/server';
import { createGelatoService } from '@/lib/gelato-service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const productUid = searchParams.get('uid');
    
    // Create service instance once for all cases
    const gelatoService = createGelatoService();

    switch (action) {
      case 'search':
        // Get all available products from Gelato
        console.log('Fetching Gelato product catalog...');
        const products = await gelatoService.getProducts();
        
        // Filter for print products only (canvas, posters, etc.)
        const printProducts = products.filter((product: any) => 
          product.uid.includes('canvas') || 
          product.uid.includes('poster') || 
          product.uid.includes('metal') || 
          product.uid.includes('acrylic') ||
          product.uid.includes('print')
        );

        return NextResponse.json({
          success: true,
          products: printProducts.map((product: any) => ({
            uid: product.uid,
            name: product.name || product.uid.replace(/_/g, ' '),
            description: product.description || '',
            category: product.category || 'Print',
            variants: product.variants || []
          }))
        });

      case 'details':
        if (!productUid) {
          return NextResponse.json(
            { success: false, error: 'Product UID required' },
            { status: 400 }
          );
        }

        console.log('Fetching Gelato product details for:', productUid);
        const productDetails = await gelatoService.getProduct(productUid);
        
        if (!productDetails) {
          return NextResponse.json(
            { success: false, error: 'Product not found' },
            { status: 404 }
          );
        }

        // Get pricing for the product variants
        const variantsWithPricing = await Promise.all(
          (productDetails.variants || []).map(async (variant: any) => {
            try {
              // Try to get pricing for common countries
              const pricingPromises = ['GB', 'US', 'DE', 'FR'].map(async (country) => {
                try {
                  const pricing = await gelatoService.getProductPricing(productUid, variant.uid, country);
                  return { country, ...pricing };
                } catch (error) {
                  return { country, error: 'Pricing not available' };
                }
              });

              const pricing = await Promise.all(pricingPromises);
              return {
                ...variant,
                pricing: pricing.filter(p => !p.error)
              };
            } catch (error) {
              return {
                ...variant,
                pricing: []
              };
            }
          })
        );

        return NextResponse.json({
          success: true,
          product: {
            uid: productDetails.uid,
            name: productDetails.name || productUid.replace(/_/g, ' '),
            description: productDetails.description || '',
            category: productDetails.category || 'Print',
            variants: variantsWithPricing
          }
        });

      case 'pricing':
        if (!productUid) {
          return NextResponse.json(
            { success: false, error: 'Product UID required' },
            { status: 400 }
          );
        }

        const variantUid = searchParams.get('variant');
        const country = searchParams.get('country') || 'GB';

        if (!variantUid) {
          return NextResponse.json(
            { success: false, error: 'Variant UID required' },
            { status: 400 }
          );
        }

        console.log('Fetching pricing for:', productUid, variantUid, country);
        const pricing = await gelatoService.getProductPricing(productUid, variantUid, country);

        return NextResponse.json({
          success: true,
          pricing: {
            productUid,
            variantUid,
            country,
            ...pricing
          }
        });

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action',
          availableActions: ['search', 'details', 'pricing'],
          examples: [
            '/api/admin/gelato-products?action=search',
            '/api/admin/gelato-products?action=details&uid=premium-canvas-prints_premium-canvas-portrait-210gsm',
            '/api/admin/gelato-products?action=pricing&uid=premium-canvas-prints_premium-canvas-portrait-210gsm&variant=30x30-cm&country=GB'
          ]
        });
    }

  } catch (error) {
    console.error('Gelato products API error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: 'Check server logs for more information',
      troubleshooting: {
        apiKey: process.env.GELATO_API_KEY ? 'Set' : 'Missing',
        baseUrl: process.env.GELATO_API_BASE_URL || 'Using default'
      }
    }, { status: 500 });
  }
}

// POST endpoint for batch operations
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, products } = body;

    if (action === 'bulk-pricing') {
      // Get pricing for multiple products at once
      const results = await Promise.all(
        products.map(async (item: any) => {
          try {
            const pricing = await gelatoService.getProductPricing(
              item.productUid, 
              item.variantUid, 
              item.country || 'GB'
            );
            return {
              ...item,
              success: true,
              pricing
            };
          } catch (error) {
            return {
              ...item,
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error'
            };
          }
        })
      );

      return NextResponse.json({
        success: true,
        results
      });
    }

    return NextResponse.json({
      success: false,
      error: 'Invalid action'
    }, { status: 400 });

  } catch (error) {
    console.error('Gelato products POST error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}