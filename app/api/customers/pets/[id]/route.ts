import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const petId = resolvedParams.id;

    if (!petId) {
      return NextResponse.json({ error: 'Pet ID is required' }, { status: 400 });
    }

    // Get the current user
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Authorization required' }, { status: 401 });
    }

    // Create a client with the user's session
    const userSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: authHeader,
          },
        },
      }
    );

    // Verify the user is authenticated
    const { data: { user }, error: authError } = await userSupabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid authentication' }, { status: 401 });
    }

    // First, verify the pet belongs to the current user
    const { data: pet, error: fetchError } = await supabase
      .from('pets')
      .select('id, user_id, name')
      .eq('id', petId)
      .single();

    if (fetchError || !pet) {
      return NextResponse.json({ error: 'Pet not found' }, { status: 404 });
    }

    if (pet.user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized: Pet does not belong to you' }, { status: 403 });
    }

    // Delete the pet (cascade should handle related records like pet photos)
    const { error: deleteError } = await supabase
      .from('pets')
      .delete()
      .eq('id', petId);

    if (deleteError) {
      console.error('Error deleting pet:', deleteError);
      return NextResponse.json({ 
        error: 'Failed to delete pet',
        details: deleteError.message 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: `Pet "${pet.name}" has been deleted successfully` 
    });

  } catch (error) {
    console.error('Error in DELETE pets API:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}