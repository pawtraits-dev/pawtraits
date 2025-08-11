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

export async function GET(request: NextRequest) {
  try {
    // Test bucket access and list files
    const { data: files, error: listError } = await supabase.storage
      .from('hero-images')
      .list('', { limit: 10 });

    if (listError) {
      return NextResponse.json(
        { error: 'Failed to access bucket', details: listError },
        { status: 500 }
      );
    }

    // Get bucket info
    const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
    const heroImagesBucket = buckets?.find(b => b.name === 'hero-images');

    return NextResponse.json({
      success: true,
      bucket: heroImagesBucket,
      fileCount: files?.length || 0,
      files: files?.map(file => ({
        name: file.name,
        size: file.metadata?.size,
        lastModified: file.updated_at,
        isFolder: !file.metadata
      })) || [],
      message: 'Hero images bucket is accessible and ready for uploads'
    });

  } catch (error) {
    console.error('❌ Bucket test failed:', error);
    return NextResponse.json(
      { error: 'Bucket test failed', details: error },
      { status: 500 }
    );
  }
}