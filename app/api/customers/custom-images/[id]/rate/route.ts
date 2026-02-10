import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    console.log('⭐ [CUSTOM IMAGE RATE] Rating custom image:', id);

    // Authenticate user using cookie-based auth
    const cookieStore = await cookies();
    const supabaseAuth = createRouteHandlerClient({ cookies: () => cookieStore });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();

    if (authError || !user) {
      console.error('❌ [CUSTOM IMAGE RATE] Auth failed:', authError);
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Parse request body
    const { rating } = await request.json();

    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: 'Rating must be between 1 and 5' },
        { status: 400 }
      );
    }

    console.log('✅ [CUSTOM IMAGE RATE] User authenticated:', user.email, 'Rating:', rating);

    // Use service role client for database operations
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Get custom image record and verify ownership
    const { data: customImage, error: fetchError } = await supabase
      .from('customer_custom_images')
      .select('id, customer_email')
      .eq('id', id)
      .single();

    if (fetchError || !customImage) {
      console.error('❌ [CUSTOM IMAGE RATE] Record not found:', fetchError);
      return NextResponse.json(
        { error: 'Custom image not found' },
        { status: 404 }
      );
    }

    // Verify user owns this custom image
    if (customImage.customer_email !== user.email) {
      console.error('❌ [CUSTOM IMAGE RATE] Email mismatch:', {
        recordEmail: customImage.customer_email,
        userEmail: user.email
      });
      return NextResponse.json(
        { error: 'Unauthorized access to this custom image' },
        { status: 403 }
      );
    }

    // Update rating
    const { error: updateError } = await supabase
      .from('customer_custom_images')
      .update({ rating })
      .eq('id', id);

    if (updateError) {
      console.error('❌ [CUSTOM IMAGE RATE] Update failed:', updateError);
      return NextResponse.json(
        { error: 'Failed to update rating' },
        { status: 500 }
      );
    }

    console.log('✅ [CUSTOM IMAGE RATE] Rating saved successfully');

    return NextResponse.json({ success: true, rating });

  } catch (error) {
    console.error('❌ Error rating custom image:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
