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
      if (!shippingAddress[field]) {
        return NextResponse.json(
          { error: `Missing required shipping address field: ${field}` },
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

    // Call Gelato API for shipping methods (shipping options)
    try {
      console.log('🚚 [SHIPPING API] Calling Gelato API for country:', shippingAddress.country);
      const shippingMethods = await gelatoService.getShippingMethods(shippingAddress.country);

      console.log('🚚 [SHIPPING API] Received shipping methods:', {
        count: shippingMethods?.length || 0,
        methods: shippingMethods?.map(method => ({
          uid: method.uid,
          name: method.name,
          price: method.price,
          currency: method.currency,
          estimatedDays: method.estimatedDeliveryDays
        })) || []
      });

      if (!shippingMethods || shippingMethods.length === 0) {
        return NextResponse.json(
          { error: 'No shipping options available for this destination' },
          { status: 404 }
        );
      }

      // Transform shipping methods to our format
      const transformedOptions = shippingMethods.map(method => ({
        id: method.uid || method.id,
        name: method.name,
        description: method.description || `Delivery in ${method.estimatedDeliveryDays || '5-7'} business days`,
        price: method.price || 999, // Price in minor units (cents), fallback to £9.99
        currency: method.currency || 'GBP',
        estimatedDeliveryDays: method.estimatedDeliveryDays || '5-7',
        carrier: method.carrier || method.name || 'Standard',
        service: method.service || 'Standard'
      }));

      return NextResponse.json({
        success: true,
        shippingOptions: transformedOptions,
        shippingAddress: shippingAddress
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

      // For now, return mock shipping options if Gelato API fails
      // This allows testing while Gelato integration is being finalized
      console.log('🚚 [SHIPPING API] Falling back to mock shipping options');
      
      const mockOptions = [
        {
          id: 'standard',
          name: 'Standard Shipping',
          description: 'Delivery in 5-7 business days',
          price: 999, // £9.99 in pence
          currency: 'GBP',
          estimatedDeliveryDays: '5-7',
          carrier: 'Royal Mail',
          service: 'Standard'
        },
        {
          id: 'express',
          name: 'Express Shipping',
          description: 'Delivery in 2-3 business days',
          price: 1999, // £19.99 in pence
          currency: 'GBP',
          estimatedDeliveryDays: '2-3',
          carrier: 'DPD',
          service: 'Express'
        }
      ];

      return NextResponse.json({
        success: true,
        shippingOptions: mockOptions,
        shippingAddress: shippingAddress,
        note: 'Using fallback shipping options'
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