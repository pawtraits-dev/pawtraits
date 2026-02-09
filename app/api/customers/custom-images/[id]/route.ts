import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Authenticate user using cookie-based auth
    const cookieStore = await cookies();
    const supabaseAuth = createRouteHandlerClient({ cookies: () => cookieStore });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Use service role client for database operations
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Get custom image record
    const { data: customImage, error: fetchError } = await supabase
      .from('customer_custom_images')
      .select(`
        id,
        customer_email,
        generated_image_url,
        share_token,
        status,
        error_message,
        created_at,
        generated_at
      `)
      .eq('id', params.id)
      .single();

    if (fetchError || !customImage) {
      return NextResponse.json(
        { error: 'Custom image not found' },
        { status: 404 }
      );
    }

    // Verify user owns this custom image
    if (customImage.customer_email !== user.email) {
      return NextResponse.json(
        { error: 'Unauthorized access to this custom image' },
        { status: 403 }
      );
    }

    return NextResponse.json(customImage);

  } catch (error) {
    console.error('❌ Error fetching custom image status:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
