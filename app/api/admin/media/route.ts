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
    const activeOnly = searchParams.get('activeOnly') === 'true';
    const id = searchParams.get('id');

    if (id) {
      // Get specific media by ID
      const { data, error } = await supabase
        .from('media')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return NextResponse.json(data);
    } else {
      // Get all media
      let query = supabase
        .from('media')
        .select('*')
        .order('display_order', { ascending: true });

      if (activeOnly) {
        query = query.eq('is_active', true);
      }

      const { data, error } = await query;
      if (error) throw error;

      return NextResponse.json(data || []);
    }

  } catch (error) {
    console.error('Error getting media:', error);
    return NextResponse.json(
      { error: 'Failed to fetch media types' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const mediaData = await request.json();

    const { data, error } = await supabase
      .from('media')
      .insert(mediaData)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);

  } catch (error) {
    console.error('Error creating media:', error);
    return NextResponse.json(
      { error: 'Failed to create media type' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const mediaData = await request.json();
    const { id, ...updateData } = mediaData;

    const { data, error } = await supabase
      .from('media')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);

  } catch (error) {
    console.error('Error updating media:', error);
    return NextResponse.json(
      { error: 'Failed to update media type' },
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
        { error: 'Media ID is required' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('media')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error deleting media:', error);
    return NextResponse.json(
      { error: 'Failed to delete media type' },
      { status: 500 }
    );
  }
}