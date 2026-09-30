import { NextRequest, NextResponse } from 'next/server';
import { AdminSupabaseService } from '@/lib/admin-supabase';
import { requireAdmin } from '@/lib/qr/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const { id } = await params; // Next 15+: params is a Promise
    const productId = decodeURIComponent(id);

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