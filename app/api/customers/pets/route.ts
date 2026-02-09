import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    // Support both cookie-based auth (from customise page) and Bearer token auth (from other pages)
    const cookieStore = await cookies();
    const supabaseAuth = createRouteHandlerClient({ cookies: () => cookieStore });

    let user = null;
    let authError = null;

    // Try cookie-based auth first
    const cookieAuthResult = await supabaseAuth.auth.getUser();
    if (cookieAuthResult.data?.user) {
      user = cookieAuthResult.data.user;
    } else {
      // Fallback to Bearer token auth
      const authHeader = request.headers.get('Authorization');
      if (authHeader) {
        const regularClient = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );
        const tokenAuthResult = await regularClient.auth.getUser(
          authHeader.replace('Bearer ', '')
        );
        user = tokenAuthResult.data?.user;
        authError = tokenAuthResult.error;
      }
    }

    if (!user) {
      console.log('🔧 Auth error:', authError);
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    console.log('🔧 Customer pets API: Authenticated user:', user.id, user.email);

    // Use service role key for database operations
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Get pets using RPC function
    const { data: pets, error: petsError } = await supabase
      .rpc('get_user_pets', { user_uuid: user.id });

    if (petsError) {
      console.error('🔧 Error fetching customer pets:', petsError);
      return NextResponse.json({ pets: [] }, { status: 200 });
    }

    console.log('🔧 Customer pets API: Found', pets?.length || 0, 'pets for customer');

    // Return in format expected by customise page: { pets: Pet[] }
    return NextResponse.json({ pets: pets || [] });

  } catch (error) {
    console.error('🔧 Error fetching customer pets:', error);
    return NextResponse.json(
      { error: 'Failed to fetch customer pets' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Use service role key - same as GET method
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    console.log('🔧 Customer pets POST API: Getting current user from auth header');

    // Get the authenticated user from the auth header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'No authorization header' }, { status: 401 });
    }

    // Create regular client to get user
    const regularClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data: { user }, error: authError } = await regularClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      console.log('🔧 Auth error:', authError);
      return NextResponse.json({ 
        error: 'Authentication failed', 
        details: authError?.message 
      }, { status: 401 });
    }

    console.log('🔧 Customer pets POST API: Authenticated user:', user.id, user.email);

    // Validate required fields
    if (!body.name?.trim()) {
      return NextResponse.json({ error: 'Pet name is required' }, { status: 400 });
    }

    if (!body.breed_id) {
      return NextResponse.json({ error: 'Breed selection is required' }, { status: 400 });
    }

    if (!body.animal_type || !['dog', 'cat'].includes(body.animal_type)) {
      return NextResponse.json({ error: 'Valid animal type is required' }, { status: 400 });
    }

    // Prepare pet data
    const petData = {
      user_id: user.id,
      name: body.name.trim(),
      animal_type: body.animal_type,
      breed_id: body.breed_id,
      coat_id: body.coat_id || null,
      gender: body.gender || 'unknown',
      age: body.age || null,
      birthday: body.birthday || null,
      weight: body.weight || null,
      personality_traits: body.personality_traits || [],
      special_notes: body.special_notes?.trim() || null
    };

    console.log('🔧 Adding pet with data:', petData);

    // Insert the pet using service role for better error handling
    const { data: pet, error: insertError } = await supabase
      .from('pets')
      .insert(petData)
      .select()
      .single();

    if (insertError) {
      console.error('🔧 Pet insertion error:', insertError);
      return NextResponse.json({ 
        error: 'Failed to add pet',
        details: insertError.message,
        code: insertError.code 
      }, { status: 500 });
    }

    console.log('🔧 Pet added successfully:', pet);
    return NextResponse.json({ 
      success: true, 
      pet: pet,
      message: `Pet "${pet.name}" added successfully!`
    });

  } catch (error) {
    console.error('🔧 Error in POST pets API:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}