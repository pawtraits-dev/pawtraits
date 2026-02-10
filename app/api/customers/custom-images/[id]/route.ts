import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    console.log('🔍 [CUSTOM IMAGE POLL] Fetching custom image:', id);

    // Authenticate user using cookie-based auth
    const cookieStore = await cookies();
    const supabaseAuth = createRouteHandlerClient({ cookies: () => cookieStore });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();

    if (authError || !user) {
      console.error('❌ [CUSTOM IMAGE POLL] Auth failed:', authError);
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    console.log('✅ [CUSTOM IMAGE POLL] User authenticated:', user.email);

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
      .eq('id', id)
      .single();

    console.log('📊 [CUSTOM IMAGE POLL] Query result:', {
      found: !!customImage,
      error: fetchError?.message,
      recordEmail: customImage?.customer_email,
      userEmail: user.email,
      status: customImage?.status,
      hasImageUrl: !!customImage?.generated_image_url
    });

    if (fetchError || !customImage) {
      console.error('❌ [CUSTOM IMAGE POLL] Record not found:', fetchError);
      return NextResponse.json(
        { error: 'Custom image not found', details: fetchError?.message },
        { status: 404 }
      );
    }

    // Verify user owns this custom image
    if (customImage.customer_email !== user.email) {
      console.error('❌ [CUSTOM IMAGE POLL] Email mismatch:', {
        recordEmail: customImage.customer_email,
        userEmail: user.email
      });
      return NextResponse.json(
        { error: 'Unauthorized access to this custom image' },
        { status: 403 }
      );
    }

    console.log('✅ [CUSTOM IMAGE POLL] Returning record:', {
      status: customImage.status,
      hasImageUrl: !!customImage.generated_image_url
    });

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
