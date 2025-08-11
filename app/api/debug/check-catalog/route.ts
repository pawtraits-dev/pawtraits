import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, serviceRoleKey);

export async function GET(request: NextRequest) {
  try {
    // Check total count of images in catalog
    const { count: totalCount } = await supabase
      .from('image_catalog')
      .select('*', { count: 'exact', head: true });
    
    // Check public images count
    const { count: publicCount } = await supabase
      .from('image_catalog')
      .select('*', { count: 'exact', head: true })
      .eq('is_public', true);
    
    // Get latest 5 images for debugging
    const { data: latestImages, error } = await supabase
      .from('image_catalog')
      .select(`
        id,
        filename,
        prompt_text,
        is_public,
        created_at,
        breed:breeds(name),
        theme:themes(name)
      `)
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (error) {
      console.error('Error fetching latest images:', error);
    }
    
    return NextResponse.json({
      totalImages: totalCount || 0,
      publicImages: publicCount || 0,
      latestImages: latestImages || [],
      error: error?.message || null
    });
    
  } catch (error) {
    console.error('Error checking catalog:', error);
    return NextResponse.json(
      { error: 'Failed to check catalog' },
      { status: 500 }
    );
  }
}