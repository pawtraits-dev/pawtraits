import { NextRequest, NextResponse } from 'next/server';
import { AdminSupabaseService } from '@/lib/admin-supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const productId = decodeURIComponent(params.id);
    console.log('Admin Product API - Received product ID:', params.id);
    console.log('Admin Product API - Decoded product ID:', productId);

    const adminService = new AdminSupabaseService();

    // Get product by ID (should be a UUID)
    const product = await adminService.getProduct(productId);
    
    if (!product) {
      console.error('Admin Product API - Product not found by ID:', productId);
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