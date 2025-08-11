import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    console.log('Setting up default media types...');

    // Insert default media types
    const defaultMedia = [
      {
        name: 'Canvas Print',
        slug: 'canvas-print',
        description: 'Premium canvas print with gallery wrap finish',
        category: 'canvas',
        material_type: 'canvas',
        finish_type: 'matte',
        base_cost_multiplier: 1.0,
        display_order: 1,
        is_active: true,
        uv_resistant: true,
        indoor_outdoor: 'indoor'
      },
      {
        name: 'Framed Print',
        slug: 'framed-print', 
        description: 'Professional framed print with premium materials',
        category: 'framed',
        material_type: 'paper',
        finish_type: 'matte',
        base_cost_multiplier: 1.2,
        display_order: 2,
        is_active: true,
        uv_resistant: true,
        indoor_outdoor: 'indoor'
      },
      {
        name: 'Acrylic Print',
        slug: 'acrylic-print',
        description: 'Vibrant acrylic print with high-gloss finish', 
        category: 'acrylic',
        material_type: 'acrylic',
        finish_type: 'gloss',
        base_cost_multiplier: 1.5,
        display_order: 3,
        is_active: true,
        uv_resistant: true,
        water_resistant: true,
        indoor_outdoor: 'both'
      },
      {
        name: 'Metal Print',
        slug: 'metal-print',
        description: 'Durable aluminum print with modern finish',
        category: 'metal', 
        material_type: 'aluminum',
        finish_type: 'brushed',
        base_cost_multiplier: 1.4,
        display_order: 4,
        is_active: true,
        uv_resistant: true,
        water_resistant: true,
        indoor_outdoor: 'both'
      },
      {
        name: 'Premium Paper Print',
        slug: 'premium-paper-print',
        description: 'High-quality paper print with archival inks',
        category: 'paper',
        material_type: 'paper', 
        finish_type: 'matte',
        base_cost_multiplier: 0.8,
        display_order: 5,
        is_active: true,
        uv_resistant: false,
        indoor_outdoor: 'indoor'
      }
    ];

    // Insert media types one by one to avoid conflicts
    const results = [];
    for (const media of defaultMedia) {
      try {
        const { data, error } = await supabase
          .from('media')
          .upsert(media, { onConflict: 'slug' })
          .select()
          .single();

        if (error) {
          results.push({ media: media.name, status: 'error', error: error.message });
        } else {
          results.push({ media: media.name, status: 'success', id: data.id });
        }
      } catch (err) {
        results.push({ media: media.name, status: 'error', error: String(err) });
      }
    }

    return NextResponse.json({
      message: 'Default media types setup completed',
      results
    });

  } catch (error) {
    console.error('Error setting up default media:', error);
    return NextResponse.json(
      { error: 'Failed to setup default media', details: error },
      { status: 500 }
    );
  }
}