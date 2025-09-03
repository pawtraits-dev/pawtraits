import { NextRequest, NextResponse } from 'next/server';
import { ImageDescriptionGenerator } from '@/lib/image-description-generator';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    console.log('Received base64 description generation request');
    const { imageData, breedName, breedSlug } = await req.json();
    
    console.log('Request info:', { 
      hasImageData: !!imageData, 
      imageDataLength: imageData?.length,
      breedName,
      breedSlug 
    });
    
    if (!imageData) {
      return NextResponse.json({ error: 'Image data required' }, { status: 400 });
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

    console.log('Creating description generator...');
    const generator = new ImageDescriptionGenerator();
    
    console.log('Generating description with:', {
      breedName: breedData?.name || breedName,
      hasTraits: !!breedData?.personality_traits
    });
    
    // Create a temporary file-like object from base64 data
    const imageBuffer = Buffer.from(imageData, 'base64');
    const tempFile = new File([imageBuffer], 'temp.png', { type: 'image/png' });
    
    const description = await generator.generateDescriptionFromFile(
      tempFile,
      breedData?.name || breedName,
      breedData?.personality_traits
    );

    console.log('Description generated successfully, length:', description.length);

    return NextResponse.json({ 
      description,
      breed: breedData?.name || breedName,
      traits: breedData?.personality_traits
    });

  } catch (error) {
    console.error('Base64 description generation failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Failed to generate description: ${errorMessage}` }, 
      { status: 500 }
    );
  }
}