import { NextRequest, NextResponse } from 'next/server';
import { createGelatoService } from '@/lib/gelato-service';

export async function GET(request: NextRequest) {
  try {
    console.log('🔧 Debug: Testing Gelato API connection...');
    
    const gelatoService = createGelatoService();
    
    // Test basic API connection
    const connectionTest = await gelatoService.testApiConnection();
    
    const result = {
      timestamp: new Date().toISOString(),
      environment: process.env.GELATO_ENVIRONMENT || 'sandbox',
      apiKeyConfigured: !!process.env.GELATO_API_KEY,
      apiKeyLength: process.env.GELATO_API_KEY?.length || 0,
      connectionTest: connectionTest
    };
    
    console.log('🔧 Debug result:', result);
    
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('💥 Debug error:', error);
    return NextResponse.json(
      { 
        error: 'Debug test failed', 
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('🔧 Debug: Testing Gelato shipping methods...');
    
    const { country = 'GB' } = await request.json();
    const gelatoService = createGelatoService();
    
    // Test shipping methods API
    try {
      const shippingMethods = await gelatoService.getShippingMethods(country);
      
      return NextResponse.json({
        success: true,
        country: country,
        shippingMethods: shippingMethods,
        methodCount: shippingMethods.length,
        timestamp: new Date().toISOString()
      });
      
    } catch (shippingError) {
      return NextResponse.json({
        success: false,
        country: country,
        error: shippingError instanceof Error ? shippingError.message : 'Unknown shipping error',
        timestamp: new Date().toISOString()
      });
    }
    
  } catch (error) {
    console.error('💥 Debug shipping error:', error);
    return NextResponse.json(
      { 
        error: 'Debug shipping test failed', 
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}