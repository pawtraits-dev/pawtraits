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
        
        return NextResponse.json({
          success: true,
          products: products.map((product: any) => ({
            uid: product.uid,
            name: product.name,
            description: product.description,
            category: product.category,
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

        // Don't fetch pricing automatically - it will be fetched manually after variant selection
        // Just return the variants without pricing data
        const variantsWithoutPricing = (productDetails.variants || []).map((variant: any) => ({
          ...variant,
          // Note: Pricing will be fetched separately after complete variant configuration
        }));

        return NextResponse.json({
          success: true,
          product: {
            uid: productDetails.uid,
            name: productDetails.name || productUid.replace(/_/g, ' '),
            description: productDetails.description || '',
            category: productDetails.category || 'Print',
            variants: variantsWithoutPricing
          }
        });

      case 'pricing':
        if (!productUid) {
          return NextResponse.json(
            { success: false, error: 'Product UID required' },
            { status: 400 }
          );
        }

        const country = searchParams.get('country') || 'GB';
        const currency = searchParams.get('currency');
        const pageCount = searchParams.get('pageCount');

        console.log('Fetching pricing for:', productUid, { country, currency, pageCount });
        
        const options: any = { country };
        if (currency) options.currency = currency;
        if (pageCount) options.pageCount = parseInt(pageCount);
        
        const prices = await gelatoService.getProductPrices(productUid, options);

        return NextResponse.json({
          success: true,
          productUid,
          country,
          prices
        });

      case 'multi-country-pricing':
        if (!productUid) {
          return NextResponse.json(
            { success: false, error: 'Product UID required' },
            { status: 400 }
          );
        }

        const countries = searchParams.get('countries')?.split(',') || ['GB', 'US', 'DE', 'FR'];
        console.log('Fetching multi-country pricing for:', productUid, countries);
        
        const multiCountryPricing = await gelatoService.getMultiCountryPricing(productUid, countries);

        return NextResponse.json({
          success: true,
          productUid,
          countries,
          pricing: multiCountryPricing
        });

      case 'base-cost':
        if (!productUid) {
          return NextResponse.json(
            { success: false, error: 'Product UID required' },
            { status: 400 }
          );
        }

        const baseCostCountry = searchParams.get('country') || 'GB';
        console.log('Fetching base cost for:', productUid, baseCostCountry);
        
        const baseCost = await gelatoService.getBaseCost(productUid, baseCostCountry);

        if (!baseCost) {
          return NextResponse.json(
            { success: false, error: 'No pricing data available' },
            { status: 404 }
          );
        }

        return NextResponse.json({
          success: true,
          productUid,
          country: baseCostCountry,
          baseCost
        });

      case 'search-product-uid':
        // This will be handled by POST method below
        return NextResponse.json({
          success: false,
          error: 'Use POST method for product UID search'
        }, { status: 405 });

      case 'get-skus':
        if (!productUid) {
          return NextResponse.json(
            { success: false, error: 'Product catalog UID required' },
            { status: 400 }
          );
        }

        console.log('Fetching available SKUs for catalog:', productUid);
        try {
          // Use the searchProducts method to get all products for this catalog
          const allProducts = await gelatoService.searchProducts(productUid, {});
          
          // Extract SKUs and their details
          const skus = allProducts.map((product: any) => ({
            uid: product.uid,
            title: product.title || product.name,
            dimensions: product.dimensions,
            attributes: product.attributes,
            description: product.description
          }));

          console.log(`Found ${skus.length} SKUs for catalog ${productUid}`);
          
          return NextResponse.json({
            success: true,
            catalogUid: productUid,
            skus: skus
          });
        } catch (error) {
          console.error('Error fetching SKUs:', error);
          return NextResponse.json({
            success: false,
            error: 'Failed to fetch SKUs'
          }, { status: 500 });
        }

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action',
          availableActions: ['search', 'details', 'pricing', 'multi-country-pricing', 'base-cost', 'get-skus', 'search-product-uid (POST)'],
          examples: [
            '/api/admin/gelato-products?action=search',
            '/api/admin/gelato-products?action=details&uid=canvas',
            '/api/admin/gelato-products?action=get-skus&uid=canvas',
            '/api/admin/gelato-products?action=pricing&uid=canvas_300x450-mm_canvas_wood-fsc-slim_ver&country=GB',
            '/api/admin/gelato-products?action=multi-country-pricing&uid=canvas_300x450-mm_canvas_wood-fsc-slim_ver&countries=GB,US,DE',
            '/api/admin/gelato-products?action=base-cost&uid=canvas_300x450-mm_canvas_wood-fsc-slim_ver&country=GB',
            'POST /api/admin/gelato-products?action=search-product-uid with body: {catalogUid, attributes}'
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
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const body = await request.json();
    const gelatoService = createGelatoService();

    switch (action) {
      case 'search-product-uid':
        // Get the correct Product UID from Gelato's Product Search API
        const { catalogUid, attributes } = body;
        
        if (!catalogUid || !attributes) {
          return NextResponse.json({
            success: false,
            error: 'catalogUid and attributes are required'
          }, { status: 400 });
        }

        console.log('Getting Product UID for:', catalogUid, attributes);
        const result = await gelatoService.getProductUidFromAttributes(catalogUid, attributes);

        if (result) {
          return NextResponse.json({
            success: true,
            productUid: result.productUid,
            productDetails: result.productDetails,
            catalogUid,
            attributes
          });
        } else {
          return NextResponse.json({
            success: false,
            error: 'No product found for the selected attributes'
          }, { status: 404 });
        }

      case 'bulk-pricing':
      default:
        // Handle legacy bulk-pricing action
        const { products } = body;
        
        if (!products) {
          return NextResponse.json({
            success: false,
            error: 'Invalid action or missing data'
          }, { status: 400 });
        }

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

  } catch (error) {
    console.error('Gelato products POST error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}