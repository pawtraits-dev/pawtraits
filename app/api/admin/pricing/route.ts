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
    const productId = searchParams.get('productId');
    const countryCode = searchParams.get('countryCode');

    let query = supabase
      .from('product_pricing')
      .select('*, country:countries(*), product:products(*)');

    if (productId) {
      query = query.eq('product_id', productId);
    }

    if (countryCode) {
      query = query.eq('country_code', countryCode);
    }

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json(data || []);

  } catch (error) {
    console.error('Error getting pricing:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pricing' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const pricingData = await request.json();
    console.log('Received pricing data:', pricingData);

    // Get country info to fill currency fields
    const { data: country } = await supabase
      .from('countries')
      .select('currency_code, currency_symbol')
      .eq('code', pricingData.country_code)
      .single();

    if (!country) {
      throw new Error('Country not found');
    }

    const fullPricingData = {
      product_id: pricingData.product_id,
      country_code: pricingData.country_code,
      product_cost: pricingData.product_cost || pricingData.base_cost,
      shipping_cost: pricingData.shipping_cost || 0,
      sale_price: pricingData.sale_price || pricingData.retail_price,
      currency_code: country.currency_code,
      currency_symbol: country.currency_symbol,
      discount_price: pricingData.discount_price || null,
      is_on_sale: pricingData.is_on_sale || false,
      sale_start_date: pricingData.sale_start_date || null,
      sale_end_date: pricingData.sale_end_date || null
    };
    
    console.log('Full pricing data to insert:', fullPricingData);

    const { data, error } = await supabase
      .from('product_pricing')
      .insert(fullPricingData)
      .select('*, country:countries(*), product:products(*)')
      .single();

    if (error) throw error;

    return NextResponse.json(data);

  } catch (error) {
    console.error('Error creating pricing:', error);
    return NextResponse.json(
      { error: 'Failed to create pricing' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const pricingData = await request.json();
    const { id, ...updateData } = pricingData;

    // Recalculate profit margins if pricing changes
    if (updateData.base_cost !== undefined || updateData.shipping_cost !== undefined || updateData.retail_price !== undefined) {
      const baseCost = updateData.base_cost || 0;
      const shippingCost = updateData.shipping_cost || 0;
      const retailPrice = updateData.retail_price || 0;
      
      const totalCost = baseCost + shippingCost;
      const profit = retailPrice - totalCost;
      updateData.profit_margin_percent = totalCost > 0 ? (profit / retailPrice) * 100 : 0;
      updateData.markup_percent = totalCost > 0 ? (profit / totalCost) * 100 : 0;
    }

    const { data, error } = await supabase
      .from('product_pricing')
      .update(updateData)
      .eq('id', id)
      .select('*, country:countries(*), product:products(*)')
      .single();

    if (error) throw error;

    return NextResponse.json(data);

  } catch (error) {
    console.error('Error updating pricing:', error);
    return NextResponse.json(
      { error: 'Failed to update pricing' },
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
        { error: 'Pricing ID is required' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('product_pricing')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error deleting pricing:', error);
    return NextResponse.json(
      { error: 'Failed to delete pricing' },
      { status: 500 }
    );
  }
}