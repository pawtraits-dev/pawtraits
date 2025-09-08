import { NextRequest, NextResponse } from 'next/server';
import { SupabaseService } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const productId = params.id;
    const { searchParams } = new URL(request.url);
    const customerEmail = searchParams.get('email');

    if (!customerEmail) {
      return NextResponse.json(
        { error: 'Customer email required' },
        { status: 400 }
      );
    }

    const supabaseService = new SupabaseService();

    // Verify the customer is authenticated by checking their email exists
    const { data: { user } } = await supabaseService.getClient().auth.getUser();
    if (!user?.email || user.email !== customerEmail) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get product details with full media information (only public information suitable for customers)
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
        media!inner(
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
        formats!inner(id, name)
      `)
      .eq('id', productId)
      .eq('is_active', true)  // Only return active products to customers
      .single();

    if (productError || !product) {
      console.error('Product not found:', productError);
      return NextResponse.json(
        { error: 'Product not found' },
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