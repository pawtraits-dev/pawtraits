import { NextRequest, NextResponse } from 'next/server';
import { SupabaseService } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const productId = decodeURIComponent(params.id);
    console.log('Product API - Received product ID:', params.id);
    console.log('Product API - Decoded product ID:', productId);
    
    // Products are public data, so email is optional for now
    // We keep the parameter for consistency with other shop APIs
    const { searchParams } = new URL(request.url);
    const customerEmail = searchParams.get('email');
    console.log('Product API - Customer email:', customerEmail);

    const supabaseService = new SupabaseService();

    // Get product details with full media information (only public information suitable for customers)
    // Products are public data, so no need for strict auth verification like orders
    const { data: product, error: productError } = await supabaseService.getClient()
      .from('products')
      .select(`
        id,
        name,
        sku,
        width_cm,
        height_cm,
        size_name,
        is_active,
        stock_status,
        is_featured,
        media(
          id,
          name,
          category,
          description,
          material_type,
          finish_type,
          thickness_mm,
          indoor_outdoor,
          uv_resistant,
          water_resistant,
          care_instructions
        ),
        formats(id, name)
      `)
      .eq('id', productId)
      .eq('is_active', true)  // Only return active products to customers
      .single();

    if (productError || !product) {
      console.error('Product not found:', productError);
      console.error('Product ID searched:', productId);
      return NextResponse.json(
        { error: 'Product not found', details: productError?.message },
        { status: 404 }
      );
    }

    return NextResponse.json(product);

  } catch (error) {
    console.error('Error fetching product details:', error);
    return NextResponse.json(
      { error: 'Failed to fetch product details' },
      { status: 500 }
    );
  }
}