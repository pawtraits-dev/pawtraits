import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { data, error } = await supabase
      .from('formats')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch format' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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
      .update(processedBody)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error updating format:', error);
    return NextResponse.json(
      { error: 'Failed to update format' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { error } = await supabase
      .from('formats')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ message: 'Format deleted successfully' });
  } catch (error) {
    console.error('Error deleting format:', error);
    return NextResponse.json(
      { error: 'Failed to delete format' },
      { status: 500 }
    );
  }
}