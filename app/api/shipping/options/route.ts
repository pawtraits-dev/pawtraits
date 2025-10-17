import { NextRequest, NextResponse } from 'next/server';
import { createGelatoService } from '@/lib/gelato-service';

export async function POST(request: NextRequest) {
  try {
    console.log('🚚 [SHIPPING API] Fetching shipping options...');
    
    // Note: Shipping options don't require authentication as they're public info
    // Authentication is handled separately for order placement

    const body = await request.json();
    const { shippingAddress, cartItems } = body;

    // Validate required data
    if (!shippingAddress || !cartItems || !Array.isArray(cartItems)) {
      return NextResponse.json(
        { error: 'Invalid request data. Shipping address and cart items are required.' },
        { status: 400 }
      );
    }

    // Validate shipping address structure
    const requiredFields = ['firstName', 'lastName', 'address1', 'city', 'postalCode', 'country'];
    for (const field of requiredFields) {
      if (!shippingAddress[field] || shippingAddress[field].toString().trim() === '') {
        console.error('🚚 [SHIPPING API] Missing required field:', {
          field,
          value: shippingAddress[field],
          allFields: Object.keys(shippingAddress),
          shippingAddress: JSON.stringify(shippingAddress, null, 2)
        });
        return NextResponse.json(
          {
            error: `Missing required shipping address field: ${field}`,
            received: shippingAddress,
            requiredFields: requiredFields
          },
          { status: 400 }
        );
      }
    }

    // Validate cart items have Gelato product UIDs
    const invalidItems = cartItems.filter(item => !item.gelatoProductUid);
    if (invalidItems.length > 0) {
      return NextResponse.json(
        { error: 'Some cart items are missing Gelato product information' },
        { status: 400 }
      );
    }

    console.log('🚚 [SHIPPING API] Request validation passed');
    console.log('🚚 [SHIPPING API] Shipping to:', `${shippingAddress.city}, ${shippingAddress.country}`);
    console.log('🚚 [SHIPPING API] Cart items:', cartItems.length);

    // Initialize Gelato service (using same pattern as admin API)
    const gelatoService = createGelatoService();

    // Transform cart items for Gelato API
    const gelatoItems = cartItems.map(item => ({
      productUid: item.gelatoProductUid,
      quantity: item.quantity || 1,
      // Additional specs if needed by Gelato
      ...(item.printSpecs && {
        dimensions: {
          width: item.printSpecs.width_cm,
          height: item.printSpecs.height_cm
        },
        medium: item.printSpecs.medium,
        format: item.printSpecs.format
      })
    }));

    // Get real Gelato shipping methods for the destination country
    try {
      console.log('🚚 [SHIPPING API] Calling Gelato API for country:', shippingAddress.country);
      const shippingMethods = await gelatoService.getShippingMethods(shippingAddress.country);

      console.log('🚚 [SHIPPING API] Received shipping methods:', {
        count: shippingMethods?.length || 0,
        methods: shippingMethods?.map(method => ({
          uid: method.shipmentMethodUid,
          name: method.name,
          type: method.type,
          hasTracking: method.hasTracking
        })) || []
      });

      if (!shippingMethods || shippingMethods.length === 0) {
        console.log('🚚 [SHIPPING API] No Gelato methods found, using fallback options');
        
        // Fallback to standard options if no Gelato methods available
        const fallbackOptions = [
          {
            id: 'standard_fallback',
            name: 'Standard Delivery',
            description: 'Standard delivery to your location',
            price: 999, // £9.99 in pence
            currency: 'GBP',
            estimatedDeliveryDays: '7-10',
            carrier: 'Standard',
            service: 'Standard'
          }
        ];

        return NextResponse.json({
          success: true,
          shippingOptions: fallbackOptions,
          shippingAddress: shippingAddress,
          note: 'Using fallback shipping - no Gelato methods available for destination'
        });
      }

      // Transform Gelato shipping methods to our format with estimated pricing
      const transformedOptions = shippingMethods.map(method => {
        // Estimate pricing based on method type and destination
        let price = 999; // Default £9.99
        let estimatedDays = '5-7';
        
        if (method.type === 'express') {
          price = 1999; // £19.99 for express
          estimatedDays = '2-3';
        } else if (method.type === 'normal') {
          price = 999; // £9.99 for normal
          estimatedDays = '5-7';
        }

        // Adjust pricing based on destination country
        const countryCode = shippingAddress.country.toUpperCase();
        if (['DE', 'FR', 'ES', 'IT', 'NL', 'BE', 'AT'].includes(countryCode)) {
          // EU countries - slightly higher
          price = Math.round(price * 1.2);
        } else if (countryCode === 'US') {
          // US - convert to USD cents
          price = Math.round(price * 1.3); // Rough USD conversion
        } else if (!['GB', 'UK'].includes(countryCode)) {
          // International - higher cost
          price = Math.round(price * 1.5);
        }

        return {
          id: method.shipmentMethodUid,
          name: method.name,
          description: `${method.name} - Delivery in ${estimatedDays} business days${method.hasTracking ? ' (with tracking)' : ''}`,
          price: price,
          currency: 'GBP', // TODO: Use proper currency based on destination
          estimatedDeliveryDays: estimatedDays,
          carrier: method.name,
          service: method.type,
          hasTracking: method.hasTracking
        };
      });

      return NextResponse.json({
        success: true,
        shippingOptions: transformedOptions,
        shippingAddress: shippingAddress,
        note: 'Real Gelato shipping methods'
      });

    } catch (gelatoError: any) {
      console.error('🚚 [SHIPPING API] Gelato API error:', gelatoError);
      
      // Handle specific Gelato API errors
      if (gelatoError.message?.includes('Invalid address')) {
        return NextResponse.json(
          { error: 'Invalid shipping address. Please check your address details.' },
          { status: 400 }
        );
      }
      
      if (gelatoError.message?.includes('No shipping available')) {
        return NextResponse.json(
          { error: 'Shipping is not available to this location.' },
          { status: 404 }
        );
      }

      // Fallback to standard shipping options if Gelato API fails
      console.log('🚚 [SHIPPING API] Falling back to standard options due to API error');
      
      const fallbackOptions = [
        {
          id: 'standard_fallback',
          name: 'Standard Delivery',
          description: 'Standard delivery to your location',
          price: 999, // £9.99 in pence
          currency: 'GBP',
          estimatedDeliveryDays: '7-10',
          carrier: 'Standard',
          service: 'Standard',
          hasTracking: false
        }
      ];

      return NextResponse.json({
        success: true,
        shippingOptions: fallbackOptions,
        shippingAddress: shippingAddress,
        note: 'Using fallback shipping due to API error'
      });
    }

  } catch (error: any) {
    console.error('🚚 [SHIPPING API] Unexpected error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch shipping options',
        details: error.message 
      },
      { status: 500 }
    );
  }
}