import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const animalType = searchParams.get('animal_type');
    
    let query = supabase
      .from('coats')
      .select('*');
    
    if (animalType && (animalType === 'dog' || animalType === 'cat')) {
      query = query.eq('animal_type', animalType);
    }
    
    const { data, error } = await query.order('sort_order', { ascending: true });

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching coats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch coats' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const { data, error } = await supabase
      .from('coats')
      .insert(body)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error creating coat:', error);
    return NextResponse.json(
      { error: 'Failed to create coat' },
      { status: 500 }
    );
  }
}