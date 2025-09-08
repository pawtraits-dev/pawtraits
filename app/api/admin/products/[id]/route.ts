import { NextRequest, NextResponse } from 'next/server';
import { AdminSupabaseService } from '@/lib/admin-supabase';
import { SupabaseService } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const productId = decodeURIComponent(params.id);
    console.log('Admin Product API - Received product ID:', params.id);
    console.log('Admin Product API - Decoded product ID:', productId);

    const adminService = new AdminSupabaseService();

    // Try to get product by ID first, then fall back to SKU lookup
    let product = await adminService.getProduct(productId);
    
    // If not found by ID, try the service's built-in SKU handling via the regular service calls
    // The SupabaseService getProductById already handles SKU fallback internally
    const supabaseService = new SupabaseService();
    if (!product) {
      console.log('Admin Product API - Product not found by admin service, trying regular service with SKU fallback');
      product = await supabaseService.getProductById(productId);
    }
    
    if (!product) {
      console.error('Admin Product API - Product not found by ID or SKU:', productId);
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    console.log('Admin Product API - Found product:', product);
    return NextResponse.json(product);

  } catch (error) {
    console.error('Admin Product API - Error fetching product details:', error);
    return NextResponse.json(
      { error: 'Failed to fetch product details' },
      { status: 500 }
    );
  }
}