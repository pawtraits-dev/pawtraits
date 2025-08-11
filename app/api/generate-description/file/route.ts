import { NextRequest, NextResponse } from 'next/server';
import { ImageDescriptionGenerator } from '@/lib/image-description-generator';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    console.log('Received description generation request');
    const formData = await req.formData();
    const file = formData.get('image') as File;
    const breed = formData.get('breed') as string;
    const breedSlug = formData.get('breedSlug') as string;
    
    console.log('File info:', { 
      hasFile: !!file, 
      fileName: file?.name, 
      fileType: file?.type, 
      fileSize: file?.size,
      breed,
      breedSlug 
    });
    
    if (!file) {
      return NextResponse.json({ error: 'Image file required' }, { status: 400 });
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Invalid file type. Please upload an image.' }, { status: 400 });
    }

    // Validate file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large. Maximum size is 10MB.' }, { status: 400 });
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
      breedName: breedData?.name || breed,
      hasTraits: !!breedData?.personality_traits
    });
    
    const description = await generator.generateDescriptionFromFile(
      file,
      breedData?.name || breed,
      breedData?.personality_traits
    );

    console.log('Description generated successfully, length:', description.length);

    return NextResponse.json({ 
      description,
      breed: breedData?.name || breed,
      traits: breedData?.personality_traits
    });

  } catch (error) {
    console.error('Description generation from file failed:', error);
    // Return more detailed error information
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Failed to generate description: ${errorMessage}` }, 
      { status: 500 }
    );
  }
}