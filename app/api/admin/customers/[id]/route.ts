import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // TODO: Add admin authentication check
    
    // Use service role key for admin operations
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    
    console.log('Admin customer detail API: Fetching customer from user_profiles', id);
    
    // Query user_profiles for customer data
    const { data: customerProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select(`
        id,
        user_id,
        first_name,
        last_name,
        email,
        phone,
        status,
        created_at,
        updated_at
      `)
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

    console.log('Admin customer detail API: Found customer profile');

    // Get pets data for this customer
    const { data: pets, error: petsError } = await supabase
      .rpc('get_user_pets', { user_uuid: customerProfile.user_id });

    const petCount = petsError || !pets ? 0 : pets.length;

    // Transform customer data to match expected Customer interface format
    const customerData = {
      id: customerProfile.id,
      user_id: customerProfile.user_id,
      email: customerProfile.email || '',
      first_name: customerProfile.first_name || '',
      last_name: customerProfile.last_name || '',
      full_name: customerProfile.first_name && customerProfile.last_name 
        ? `${customerProfile.first_name} ${customerProfile.last_name}` 
        : customerProfile.first_name || customerProfile.last_name || null,
      phone: customerProfile.phone || null,
      is_registered: true,
      is_active: customerProfile.status === 'active',
      total_pets: petCount,
      total_orders: 0, // TODO: Calculate from orders table if needed
      total_spent: 0, // TODO: Calculate from orders table if needed
      avg_order_value: 0,
      first_order_date: null,
      last_order_date: null,
      customer_status: customerProfile.status || 'active',
      customer_segment: 'New', // Default segment
      marketing_consent: false, // TODO: Get from customer preferences if needed
      email_verified: true, // Assume verified if in system
      phone_verified: false, // Default to false
      created_at: customerProfile.created_at,
      updated_at: customerProfile.updated_at,
      referred_by_partner_id: null // TODO: Get from referral system if needed
    };

    console.log('Admin customer detail API: Returning customer data with', petCount, 'pets');
    return NextResponse.json(customerData);
  } catch (error) {
    console.error('Error fetching customer details for admin:', error);
    return NextResponse.json(
      { error: 'Failed to fetch customer details' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    // TODO: Add admin authentication check
    const body = await request.json();
    
    console.log('Admin customer update API: Updating customer', id, 'with data:', body);
    
    // Use service role key for admin operations
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Update user_profiles table
    const { data, error } = await supabase
      .from('user_profiles')
      .update(body)
      .eq('id', id)
      .eq('user_type', 'customer')
      .select()
      .single();

    if (error) {
      console.error('Error updating customer profile:', error);
      throw error;
    }

    console.log('Admin customer update API: Successfully updated customer');

    // TODO: Log admin action
    // await logAdminAction(adminId, 'update_customer', 'customer', id);

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error updating customer:', error);
    return NextResponse.json(
      { error: 'Failed to update customer' },
      { status: 500 }
    );
  }
}