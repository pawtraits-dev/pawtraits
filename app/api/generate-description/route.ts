import { NextRequest, NextResponse } from 'next/server';
import { ImageDescriptionGenerator } from '@/lib/image-description-generator';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { imageUrl, breed, breedSlug } = await req.json();
    
    if (!imageUrl) {
      return NextResponse.json({ error: 'Image URL required' }, { status: 400 });
    }

    // Fetch breed info from database if breedSlug provided
    let breedData = null;
    if (breedSlug) {
      const { data } = await supabase
        .from('breeds')
        .select('name, personality_traits')
        .eq('slug', breedSlug)
        .eq('is_active', true)
        .single();
      
      breedData = data;
    }

    const generator = new ImageDescriptionGenerator();
    const description = await generator.generateDescription(
      imageUrl,
      breedData?.name || breed,
      breedData?.personality_traits
    );

    return NextResponse.json({ 
      description,
      breed: breedData?.name || breed,
      traits: breedData?.personality_traits
    });

  } catch (error) {
    console.error('Description generation failed:', error);
    return NextResponse.json(
      { error: 'Failed to generate description' }, 
      { status: 500 }
    );
  }
}