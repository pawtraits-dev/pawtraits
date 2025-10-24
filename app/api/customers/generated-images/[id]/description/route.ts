import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();
    const { aiDescription } = body;

    if (!aiDescription) {
      return NextResponse.json(
        { error: 'AI description is required' },
        { status: 400 }
      );
    }

    // Use service role client to update the image
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Get existing generation_metadata
    const { data: existingImage, error: fetchError } = await supabaseAdmin
      .from('customer_generated_images')
      .select('generation_metadata')
      .eq('id', id)
      .single();

    if (fetchError || !existingImage) {
      return NextResponse.json(
        { error: 'Image not found' },
        { status: 404 }
      );
    }

    // Update generation_metadata with AI description
    const updatedMetadata = {
      ...(existingImage.generation_metadata || {}),
      ai_description: aiDescription
    };

    const { error: updateError } = await supabaseAdmin
      .from('customer_generated_images')
      .update({
        generation_metadata: updatedMetadata
      })
      .eq('id', id);

    if (updateError) {
      console.error('Error updating AI description:', updateError);
      return NextResponse.json(
        { error: 'Failed to update description' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'AI description updated successfully'
    });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
