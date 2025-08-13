import { NextRequest, NextResponse } from 'next/server';
import { gelatoService } from '@/lib/gelato-service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'products';

    switch (action) {
      case 'products':
        // Test: Get available products from Gelato
        console.log('Testing Gelato products API...');
        const products = await gelatoService.getProducts();
        return NextResponse.json({
          success: true,
          action: 'get_products',
          products: products.slice(0, 5), // Limit to first 5 for testing
          total: products.length
        });

      case 'product':
        // Test: Get specific product details
        const productUid = searchParams.get('uid') || 'premium-canvas-prints_premium-canvas-portrait-210gsm';
        console.log('Testing Gelato product details API for:', productUid);
        
        const product = await gelatoService.getProduct(productUid);
        return NextResponse.json({
          success: true,
          action: 'get_product',
          productUid,
          product
        });

      case 'shipping':
        // Test: Get shipping methods for a country
        const country = searchParams.get('country') || 'GB';
        console.log('Testing Gelato shipping methods for:', country);
        
        const shippingMethods = await gelatoService.getShippingMethods(country);
        return NextResponse.json({
          success: true,
          action: 'get_shipping_methods',
          country,
          shippingMethods
        });

      case 'test-order':
        // Test: Create a test order (sandbox only!)
        console.log('Creating test Gelato order...');
        
        const testOrderData = {
          externalId: `TEST-${Date.now()}`,
          orderReferenceId: `test-${Date.now()}`,
          shippingAddress: {
            firstName: 'Test',
            lastName: 'Customer',
            address1: '123 Test Street',
            city: 'London',
            postalCode: 'SW1A 1AA',
            country: 'GB',
            email: 'test@example.com'
          },
          items: [
            {
              productUid: 'premium-canvas-prints_premium-canvas-portrait-210gsm',
              variantUid: '30x30-cm',
              quantity: 1,
              printFileUrl: gelatoService.generatePrintImageUrl('test-image', 30, 30),
              printFileType: 'url' as const,
              personalizationParts: {
                title: 'Test Pet Portrait'
              }
            }
          ],
          currency: 'GBP',
          metadata: {
            test: 'true',
            source: 'pawtraits-api-test'
          }
        };

        const testOrder = await gelatoService.createOrder(testOrderData);
        return NextResponse.json({
          success: true,
          action: 'create_test_order',
          order: testOrder,
          warning: 'This is a test order - ensure you are using sandbox environment!'
        });

      case 'image-url':
        // Test: Generate print-ready image URL
        const imageId = searchParams.get('imageId') || 'sample-image-id';
        const width = parseInt(searchParams.get('width') || '30');
        const height = parseInt(searchParams.get('height') || '30');
        
        const imageUrl = gelatoService.generatePrintImageUrl(imageId, width, height);
        return NextResponse.json({
          success: true,
          action: 'generate_image_url',
          imageId,
          dimensions: `${width}x${height}cm`,
          printImageUrl: imageUrl
        });

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action',
          availableActions: ['products', 'product', 'shipping', 'test-order', 'image-url'],
          examples: [
            '/api/admin/test-gelato?action=products',
            '/api/admin/test-gelato?action=product&uid=premium-canvas-prints_premium-canvas-portrait-210gsm',
            '/api/admin/test-gelato?action=shipping&country=GB',
            '/api/admin/test-gelato?action=image-url&imageId=test&width=40&height=40',
            '/api/admin/test-gelato?action=test-order (SANDBOX ONLY!)'
          ]
        });
    }

  } catch (error) {
    console.error('Gelato test error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: 'Check server logs for more information',
      troubleshooting: {
        apiKey: process.env.GELATO_API_KEY ? 'Set' : 'Missing',
        baseUrl: process.env.GELATO_API_BASE_URL || 'Using default',
        environment: process.env.NODE_ENV
      }
    }, { status: 500 });
  }
}

// POST endpoint for testing order creation with custom data
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    console.log('Creating Gelato order with custom data:', body);
    
    const order = await gelatoService.createOrder(body);
    
    return NextResponse.json({
      success: true,
      action: 'create_custom_order',
      order,
      warning: 'Ensure you are using sandbox environment for testing!'
    });

  } catch (error) {
    console.error('Custom Gelato order creation error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: 'Check server logs for more information'
    }, { status: 500 });
  }
}