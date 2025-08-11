import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    console.log('Setting up storage policies...');

    // First, let's check if the bucket exists
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    
    if (bucketsError) {
      return NextResponse.json(
        { error: 'Failed to list buckets', details: bucketsError.message },
        { status: 500 }
      );
    }

    const petPhotosBucket = buckets.find(b => b.name === 'pet-photos');
    if (!petPhotosBucket) {
      return NextResponse.json(
        { error: 'pet-photos bucket not found. Please create it first.' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      message: 'Storage bucket verified successfully',
      bucket: petPhotosBucket,
      note: 'Storage policies need to be set up manually in the Supabase Dashboard under Storage > Policies',
      instructions: [
        '1. Go to your Supabase Dashboard',
        '2. Navigate to Storage > Policies',
        '3. Create INSERT policy for authenticated users: bucket_id = \'pet-photos\'',
        '4. Create SELECT policy for public access: bucket_id = \'pet-photos\'',
        '5. Optional: Create DELETE policy for users to delete their own photos'
      ]
    });

  } catch (error) {
    console.error('Error checking storage setup:', error);
    return NextResponse.json(
      { error: 'Failed to check storage setup', details: error },
      { status: 500 }
    );
  }
}