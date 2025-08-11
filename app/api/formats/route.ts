import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('formats')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch formats' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Convert JSON objects to strings for database storage
    const processedBody = {
      ...body,
      prompt_adjustments: typeof body.prompt_adjustments === 'object' 
        ? JSON.stringify(body.prompt_adjustments) 
        : body.prompt_adjustments || '',
      midjourney_parameters: typeof body.midjourney_parameters === 'object' 
        ? JSON.stringify(body.midjourney_parameters) 
        : body.midjourney_parameters || '--style raw --v 6'
    };
    
    const { data, error } = await supabase
      .from('formats')
      .insert([processedBody])
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error creating format:', error);
    return NextResponse.json(
      { error: 'Failed to create format' },
      { status: 500 }
    );
  }
}