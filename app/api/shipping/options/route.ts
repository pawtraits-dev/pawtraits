import { NextRequest, NextResponse } from 'next/server';
import { GelatoService } from '@/lib/gelato-service';

export async function POST(request: NextRequest) {
  try {
    console.log('🚚 [SHIPPING API] Fetching shipping options...');

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

    // Initialize Gelato service
    const gelatoService = new GelatoService();

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

    // Call Gelato API for shipping options
    try {
      const shippingOptions = await gelatoService.getShippingOptions({
        shippingAddress: {
          firstName: shippingAddress.firstName,
          lastName: shippingAddress.lastName,
          companyName: shippingAddress.companyName || '',
          addressLine1: shippingAddress.address1,
          addressLine2: shippingAddress.address2 || '',
          city: shippingAddress.city,
          postalCode: shippingAddress.postalCode,
          stateCode: shippingAddress.stateCode || '',
          countryCode: shippingAddress.country
        },
        items: gelatoItems
      });

      console.log('🚚 [SHIPPING API] Received shipping options:', {
        count: shippingOptions?.length || 0,
        options: shippingOptions?.map(opt => ({
          id: opt.id,
          name: opt.name,
          price: opt.price,
          currency: opt.currency,
          estimatedDelivery: opt.estimatedDeliveryDays
        })) || []
      });

      if (!shippingOptions || shippingOptions.length === 0) {
        return NextResponse.json(
          { error: 'No shipping options available for this destination' },
          { status: 404 }
        );
      }

      // Transform shipping options to our format
      const transformedOptions = shippingOptions.map(option => ({
        id: option.id,
        name: option.name,
        description: option.description || `Delivery in ${option.estimatedDeliveryDays || '5-7'} business days`,
        price: option.price, // Price in minor units (cents)
        currency: option.currency,
        estimatedDeliveryDays: option.estimatedDeliveryDays || '5-7',
        carrier: option.carrier || 'Standard',
        service: option.service || 'Standard'
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