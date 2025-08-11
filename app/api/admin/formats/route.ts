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
    const id = searchParams.get('id');

    if (id) {
      // Get specific format by ID
      const { data, error } = await supabase
        .from('formats')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return NextResponse.json(data);
    } else {
      // Get all formats
      const { data, error } = await supabase
        .from('formats')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return NextResponse.json(data || []);
    }

  } catch (error) {
    console.error('Error getting formats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch formats' },
      { status: 500 }
    );
  }
}