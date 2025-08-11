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
    console.log('🚀 Setting up hero-images storage bucket...');

    // 1. Check if bucket already exists
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      return NextResponse.json(
        { error: 'Failed to list buckets', details: listError },
        { status: 500 }
      );
    }

    const existingBucket = buckets?.find(b => b.name === 'hero-images');
    
    if (!existingBucket) {
      // 2. Create the bucket
      console.log('📁 Creating hero-images bucket...');
      const { data: newBucket, error: createError } = await supabase.storage.createBucket('hero-images', {
        public: true,
        allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
        fileSizeLimit: 8 * 1024 * 1024, // 8MB limit
      });

      if (createError) {
        console.error('❌ Error creating bucket:', createError);
        return NextResponse.json(
          { error: 'Failed to create bucket', details: createError },
          { status: 500 }
        );
      }

      console.log('✅ hero-images bucket created successfully');
    } else {
      console.log('✅ hero-images bucket already exists');
    }

    // 3. Test the bucket access
    try {
      const { data: files, error: listFilesError } = await supabase.storage
        .from('hero-images')
        .list('', { limit: 1 });

      if (listFilesError) {
        console.error('❌ Error testing bucket access:', listFilesError);
        return NextResponse.json(
          { error: 'Bucket created but access test failed', details: listFilesError },
          { status: 500 }
        );
      }
    } catch (error) {
      console.error('❌ Bucket test failed:', error);
      return NextResponse.json(
        { error: 'Bucket access test failed', details: error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Hero images bucket setup complete',
      bucket: {
        name: 'hero-images',
        public: true,
        fileSizeLimit: '8MB',
        allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
      },
      policies: [
        'Public read access enabled',
        'Authenticated upload/update/delete enabled via bucket settings'
      ]
    });

  } catch (error) {
    console.error('❌ Setup failed:', error);
    return NextResponse.json(
      { error: 'Bucket setup failed', details: error },
      { status: 500 }
    );
  }
}