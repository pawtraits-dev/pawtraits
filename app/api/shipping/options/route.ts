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

    // For now, use standard shipping options while we resolve Gelato shipping API
    // Based on typical print-on-demand shipping times and costs
    console.log('🚚 [SHIPPING API] Using standard shipping options for country:', shippingAddress.country);
    
    // Country-specific shipping options
    const getShippingOptionsForCountry = (country: string) => {
      const countryCode = country.toUpperCase();
      
      // UK shipping options
      if (countryCode === 'GB' || countryCode === 'UK') {
        return [
          {
            id: 'standard_uk',
            name: 'Standard UK Delivery',
            description: 'Delivery in 5-7 business days',
            price: 499, // £4.99 in pence
            currency: 'GBP',
            estimatedDeliveryDays: '5-7',
            carrier: 'Royal Mail',
            service: 'Standard'
          },
          {
            id: 'express_uk',
            name: 'Express UK Delivery', 
            description: 'Delivery in 2-3 business days',
            price: 899, // £8.99 in pence
            currency: 'GBP',
            estimatedDeliveryDays: '2-3',
            carrier: 'DPD',
            service: 'Express'
          }
        ];
      }
      
      // EU shipping options
      if (['DE', 'FR', 'ES', 'IT', 'NL', 'BE', 'AT', 'SE', 'NO', 'DK'].includes(countryCode)) {
        return [
          {
            id: 'standard_eu',
            name: 'Standard EU Delivery',
            description: 'Delivery in 7-10 business days',
            price: 899, // €8.99 equivalent in pence
            currency: 'EUR',
            estimatedDeliveryDays: '7-10',
            carrier: 'DHL',
            service: 'Standard'
          },
          {
            id: 'express_eu',
            name: 'Express EU Delivery',
            description: 'Delivery in 3-5 business days', 
            price: 1599, // €15.99 equivalent in pence
            currency: 'EUR',
            estimatedDeliveryDays: '3-5',
            carrier: 'DHL',
            service: 'Express'
          }
        ];
      }
      
      // US shipping options
      if (countryCode === 'US') {
        return [
          {
            id: 'standard_us',
            name: 'Standard US Delivery',
            description: 'Delivery in 7-10 business days',
            price: 799, // $7.99 in cents
            currency: 'USD',
            estimatedDeliveryDays: '7-10',
            carrier: 'USPS',
            service: 'Standard'
          },
          {
            id: 'express_us',
            name: 'Express US Delivery',
            description: 'Delivery in 3-5 business days',
            price: 1499, // $14.99 in cents
            currency: 'USD', 
            estimatedDeliveryDays: '3-5',
            carrier: 'FedEx',
            service: 'Express'
          }
        ];
      }
      
      // Default international shipping
      return [
        {
          id: 'standard_intl',
          name: 'Standard International Delivery',
          description: 'Delivery in 10-15 business days',
          price: 1299, // £12.99 in pence
          currency: 'GBP',
          estimatedDeliveryDays: '10-15',
          carrier: 'International Post',
          service: 'Standard'
        }
      ];
    };

    const shippingOptions = getShippingOptionsForCountry(shippingAddress.country);
    
    console.log('🚚 [SHIPPING API] Shipping options for', shippingAddress.country + ':', {
      count: shippingOptions.length,
      options: shippingOptions.map(opt => ({ 
        id: opt.id, 
        name: opt.name, 
        price: opt.price, 
        currency: opt.currency 
      }))
    });

    return NextResponse.json({
      success: true,
      shippingOptions: shippingOptions,
      shippingAddress: shippingAddress,
      note: 'Using standard shipping rates - Gelato integration pending'
    });

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