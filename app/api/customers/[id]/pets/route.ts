import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Use service role key for admin operations
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    console.log('Customer pets API: Fetching pets for customer', id);

    // First get the customer's user_id from user_profiles
    const { data: customerProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('user_id')
      .eq('id', id)
      .eq('user_type', 'customer')
      .single();

    if (profileError) {
      console.error('Error fetching customer profile:', profileError);
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    // Get pets for this customer using the get_user_pets function
    const { data: pets, error: petsError } = await supabase
      .rpc('get_user_pets', { user_uuid: customerProfile.user_id });

    if (petsError) {
      console.error('Error fetching customer pets:', petsError);
      return NextResponse.json([], { status: 200 }); // Return empty array if function fails
    }

    console.log('Customer pets API: Found', pets?.length || 0, 'pets for customer');
    return NextResponse.json(pets || []);

  } catch (error) {
    console.error('Error fetching customer pets:', error);
    return NextResponse.json(
      { error: 'Failed to fetch customer pets' },
      { status: 500 }
    );
  }
}