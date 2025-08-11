import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('activeOnly') !== 'false';
    const featuredOnly = searchParams.get('featuredOnly') === 'true';
    const mediumId = searchParams.get('mediumId');
    const formatId = searchParams.get('formatId');

    let query = supabase
      .from('products')
      .select(`
        *,
        medium:media(*),
        format:formats(*)
      `);

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    if (featuredOnly) {
      query = query.eq('is_featured', true);
    }

    if (mediumId) {
      query = query.eq('medium_id', mediumId);
    }

    if (formatId) {
      query = query.eq('format_id', formatId);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json(data || []);

  } catch (error) {
    console.error('Error getting products:', error);
    return NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const productData = await request.json();

    // Get medium and format to generate SKU and name
    const [mediumResponse, formatResponse] = await Promise.all([
      supabase.from('media').select('*').eq('id', productData.medium_id).single(),
      supabase.from('formats').select('*').eq('id', productData.format_id).single()
    ]);

    if (mediumResponse.error || formatResponse.error) {
      throw new Error('Media or Format not found');
    }

    const medium = mediumResponse.data;
    const format = formatResponse.data;

    const sku = `${medium.slug.toUpperCase()}-${format.name.toUpperCase().replace(/\s+/g, '-')}-${productData.size_code}`;
    const name = `${medium.name} ${format.name} ${productData.size_name} (${productData.width_cm}x${productData.height_cm}cm)`;

    const fullProductData = {
      ...productData,
      name,
      sku
    };

    const { data, error } = await supabase
      .from('products')
      .insert(fullProductData)
      .select(`
        *,
        medium:media(*),
        format:formats(*)
      `)
      .single();

    if (error) throw error;

    return NextResponse.json(data);

  } catch (error) {
    console.error('Error creating product:', error);
    return NextResponse.json(
      { error: 'Failed to create product' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const productData = await request.json();
    const { id, ...updateData } = productData;

    if (!id) {
      return NextResponse.json(
        { error: 'Product ID is required' },
        { status: 400 }
      );
    }

    // Get medium and format to regenerate SKU and name if needed
    const [mediumResponse, formatResponse] = await Promise.all([
      supabase.from('media').select('*').eq('id', updateData.medium_id).single(),
      supabase.from('formats').select('*').eq('id', updateData.format_id).single()
    ]);

    if (mediumResponse.error || formatResponse.error) {
      throw new Error('Media or Format not found');
    }

    const medium = mediumResponse.data;
    const format = formatResponse.data;

    const sku = `${medium.slug.toUpperCase()}-${format.name.toUpperCase().replace(/\s+/g, '-')}-${updateData.size_code}`;
    const name = `${medium.name} ${format.name} ${updateData.size_name} (${updateData.width_cm}x${updateData.height_cm}cm)`;

    const fullUpdateData = {
      ...updateData,
      name,
      sku
    };

    const { data, error } = await supabase
      .from('products')
      .update(fullUpdateData)
      .eq('id', id)
      .select(`
        *,
        medium:media(*),
        format:formats(*)
      `)
      .single();

    if (error) throw error;

    return NextResponse.json(data);

  } catch (error) {
    console.error('Error updating product:', error);
    return NextResponse.json(
      { error: 'Failed to update product' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Product ID is required' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error deleting product:', error);
    return NextResponse.json(
      { error: 'Failed to delete product' },
      { status: 500 }
    );
  }
}