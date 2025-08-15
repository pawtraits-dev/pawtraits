import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createGelatoService } from '@/lib/gelato-service';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// POST /api/cart/validate - Validate cart items for Gelato availability
export async function POST(request: NextRequest) {
  try {
    // Get user from Authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authorization required' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Get validation mode from request body
    const body = await request.json();
    const { mode = 'full' } = body; // 'full' | 'quick' | 'health'

    console.log(`🔍 Starting cart validation for user ${user.id}, mode: ${mode}`);

    // Get user's current cart
    const { data: cartItems, error: cartError } = await supabase
      .rpc('get_user_cart', { p_user_id: user.id });

    if (cartError) {
      console.error('Error fetching cart for validation:', cartError);
      return NextResponse.json({ error: 'Failed to fetch cart' }, { status: 500 });
    }

    if (!cartItems || cartItems.length === 0) {
      return NextResponse.json({
        success: true,
        isValid: true,
        message: 'Cart is empty - no validation needed',
        errors: [],
        warnings: [],
        items: []
      });
    }

    // Transform cart items for validation
    const validationItems = cartItems.map((item: any) => ({
      gelatoProductUid: item.product_data?.gelato_sku,
      printSpecs: item.product_data ? {
        width_cm: item.product_data.width_cm || 30,
        height_cm: item.product_data.height_cm || 30,
        medium: item.product_data.medium?.name || 'Canvas',
        format: item.product_data.format?.name || 'Portrait'
      } : undefined,
      quantity: item.quantity,
      imageId: item.image_id,
      imageTitle: item.image_title
    }));

    console.log(`🛒 Validating ${validationItems.length} cart items`);

    // Initialize Gelato service (using same pattern as admin API)
    const gelatoService = createGelatoService();

    let validationResult;
    
    if (mode === 'health') {
      // Health check mode - just check if Gelato services are available
      const healthCheck = await gelatoService.validateGelatoServiceHealth();
      return NextResponse.json({
        success: true,
        mode: 'health',
        serviceHealth: healthCheck,
        message: healthCheck.isHealthy ? 'Gelato services are healthy' : 'Some Gelato services have issues'
      });
    } else if (mode === 'quick') {
      // Quick mode - just validate data structure, no API calls
      validationResult = {
        isValid: true,
        errors: [],
        warnings: []
      };

      for (let i = 0; i < validationItems.length; i++) {
        const item = validationItems[i];
        
        if (!item.gelatoProductUid) {
          validationResult.errors.push({
            itemIndex: i,
            imageId: item.imageId,
            imageTitle: item.imageTitle,
            error: 'Product missing Gelato integration',
            code: 'MISSING_GELATO_UID'
          });
          validationResult.isValid = false;
        }

        if (!item.printSpecs) {
          validationResult.errors.push({
            itemIndex: i,
            imageId: item.imageId,
            imageTitle: item.imageTitle,
            error: 'Product missing print specifications',
            code: 'MISSING_PRINT_SPECS'
          });
          validationResult.isValid = false;
        }
      }
    } else {
      // Full validation mode - includes API calls
      validationResult = await gelatoService.validateCartItems(validationItems);
    }

    console.log(`✅ Cart validation completed:`, {
      mode,
      isValid: validationResult.isValid,
      errors: validationResult.errors?.length || 0,
      warnings: validationResult.warnings?.length || 0
    });

    return NextResponse.json({
      success: true,
      mode,
      isValid: validationResult.isValid,
      errors: validationResult.errors || [],
      warnings: validationResult.warnings || [],
      items: validationItems.map((item, index) => ({
        index,
        imageId: item.imageId,
        imageTitle: item.imageTitle,
        gelatoProductUid: item.gelatoProductUid,
        hasValidData: !!(item.gelatoProductUid && item.printSpecs),
        printSpecs: item.printSpecs
      })),
      message: validationResult.isValid 
        ? 'All cart items are valid for printing'
        : `${validationResult.errors?.length || 0} items have validation errors`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Cart validation error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Cart validation failed', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

// GET /api/cart/validate - Quick validation status for current cart
export async function GET(request: NextRequest) {
  try {
    // Get user from Authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authorization required' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Get user's current cart item count and basic validation
    const { data: cartItems, error: cartError } = await supabase
      .rpc('get_user_cart', { p_user_id: user.id });

    if (cartError) {
      return NextResponse.json({ error: 'Failed to fetch cart' }, { status: 500 });
    }

    const itemCount = cartItems?.length || 0;
    const itemsWithGelato = cartItems?.filter((item: any) => item.product_data?.gelato_sku).length || 0;

    return NextResponse.json({
      success: true,
      itemCount,
      itemsWithGelato,
      allItemsHaveGelato: itemCount > 0 && itemsWithGelato === itemCount,
      needsValidation: itemCount > 0,
      lastChecked: new Date().toISOString()
    });

  } catch (error) {
    console.error('Cart validation status error:', error);
    return NextResponse.json(
      { error: 'Failed to check validation status' },
      { status: 500 }
    );
  }
}