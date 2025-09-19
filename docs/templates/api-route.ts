import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

// 🏗️ STANDARD API ROUTE TEMPLATE
// Copy this template for new API routes to ensure architectural compliance

export async function GET(request: NextRequest) {
  try {
    // ✅ STANDARD: Cookie-based authentication
    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ✅ User is authenticated - proceed with business logic
    console.log('🔍 API: Authenticated user:', user.id, user.email);

    // Extract parameters
    const { searchParams } = new URL(request.url);
    const someParam = searchParams.get('someParam');

    // Validate required parameters
    if (!someParam) {
      return NextResponse.json(
        { error: 'someParam is required' },
        { status: 400 }
      );
    }

    // ✅ Database operations using authenticated supabase client
    const { data, error } = await supabase
      .from('your_table')
      .select('*')
      .eq('some_field', someParam);

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Database operation failed' },
        { status: 500 }
      );
    }

    return NextResponse.json(data);

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // ✅ STANDARD: Cookie-based authentication
    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { field1, field2 } = body;

    // Validate required fields
    if (!field1 || !field2) {
      return NextResponse.json(
        { error: 'field1 and field2 are required' },
        { status: 400 }
      );
    }

    // ✅ Database operations
    const { data, error } = await supabase
      .from('your_table')
      .insert({
        field1,
        field2,
        user_id: user.id, // ✅ Associate with authenticated user
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to create record' },
        { status: 500 }
      );
    }

    return NextResponse.json(data, { status: 201 });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// 📋 CHECKLIST: Before committing this API route
// [ ] Uses createRouteHandlerClient with cookies
// [ ] Proper error handling for auth failures
// [ ] Validates required parameters/body fields
// [ ] Associates data with authenticated user where appropriate
// [ ] Consistent error response format
// [ ] No direct createClient imports
// [ ] No SupabaseService usage in API routes