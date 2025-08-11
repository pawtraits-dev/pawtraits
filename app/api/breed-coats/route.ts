import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const breedId = searchParams.get('breed_id');
    const coatId = searchParams.get('coat_id');

    // Query the actual breed_coats table with joins to get details
    let query = supabase
      .from('breed_coats')
      .select(`
        *,
        breeds!inner(id, name, slug),
        coats!inner(id, name, slug, description, hex_color, pattern_type, rarity)
      `);

    if (breedId) {
      query = query.eq('breed_id', breedId);
    }
    if (coatId) {
      query = query.eq('coat_id', coatId);
    }

    const { data, error } = await query.order('popularity_rank', { ascending: true });

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching breed-coat relationships:', error);
    return NextResponse.json(
      { error: 'Failed to fetch breed-coat relationships' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const { data, error } = await supabase
      .from('breed_coats')
      .insert(body)
      .select()
      .single();

    if (error) {
      // Handle duplicate key constraint
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'This breed-coat relationship already exists' },
          { status: 409 }
        );
      }
      throw error;
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error creating breed-coat relationship:', error);
    return NextResponse.json(
      { error: 'Failed to create breed-coat relationship' },
      { status: 500 }
    );
  }
}