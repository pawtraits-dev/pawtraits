import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const type = formData.get('type') as string;
    const entity = formData.get('entity') as string;
    const entityId = formData.get('entity_id') as string;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'File must be an image' }, { status: 400 });
    }

    // Validate file size (max 8MB - allowing for some headroom after compression)
    if (file.size > 8 * 1024 * 1024) {
      return NextResponse.json({ 
        error: `File size is ${(file.size / (1024 * 1024)).toFixed(1)}MB. Maximum allowed is 8MB.` 
      }, { status: 400 });
    }

    // Generate unique filename
    const timestamp = Date.now();
    const fileName = `${entity}-${entityId}-${type}-${timestamp}-${file.name}`;
    
    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('hero-images')
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: false
      });

    if (error) {
      console.error('Upload error:', error);
      return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from('hero-images')
      .getPublicUrl(data.path);

    return NextResponse.json({
      success: true,
      public_url: publicUrlData.publicUrl,
      path: data.path
    });

  } catch (error) {
    console.error('Upload API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}