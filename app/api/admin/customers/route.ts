import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  try {
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
    
    console.log('Admin customers API: Fetching customers from user_profiles...');
    
    // Query user_profiles for customers
    const { data: customerProfiles, error: profilesError } = await supabase
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
      .eq('user_type', 'customer')
      .order('created_at', { ascending: false });

    if (profilesError) {
      throw profilesError;
    }

    if (!customerProfiles || customerProfiles.length === 0) {
      console.log('Admin customers API: No customer profiles found');
      return NextResponse.json([]);
    }

    console.log('Admin customers API: Found', customerProfiles.length, 'customer profiles');

    // Get pet counts and referral data for each customer
    const customersWithPets = await Promise.all(
      customerProfiles.map(async (profile) => {
        try {
          // Get pet count for this user
          const { data: pets, error: petsError } = await supabase
            .rpc('get_user_pets', { user_uuid: profile.user_id });

          const petCount = petsError || !pets ? 0 : pets.length;

          // Get customer record to check for referral_scans_count
          const { data: customerRecord } = await supabase
            .from('customers')
            .select('referral_scans_count, personal_referral_code')
            .eq('email', profile.email)
            .maybeSingle();

          const totalScans = customerRecord?.referral_scans_count || 0;

          // Get referred customers (signups using this customer's code)
          const { data: referredCustomers } = await supabase
            .from('customers')
            .select('id')
            .eq('referral_type', 'CUSTOMER')
            .eq('referrer_id', profile.id);

          const totalSignups = referredCustomers ? referredCustomers.length : 0;

          // Transform to match expected AdminCustomerOverview interface
          return {
            id: profile.id,
            user_id: profile.user_id,
            email: profile.email || '',
            first_name: profile.first_name || null,
            last_name: profile.last_name || null,
            full_name: profile.first_name && profile.last_name
              ? `${profile.first_name} ${profile.last_name}`
              : profile.first_name || profile.last_name || null,
            phone: profile.phone || null,
            is_registered: true, // Since they're in user_profiles, they're registered
            total_pets: petCount,
            total_orders: 0, // TODO: Calculate from orders table if needed
            total_spent: 0, // TODO: Calculate from orders table if needed
            avg_order_value: 0,
            first_order_date: null,
            last_order_date: null,
            customer_status: profile.status || 'active',
            customer_segment: 'New', // Default segment
            marketing_consent: false, // TODO: Get from customer preferences if needed
            email_verified: true, // Assume verified if in system
            phone_verified: false, // Default to false
            created_at: profile.created_at,
            updated_at: profile.updated_at,
            referred_by_partner_id: null, // TODO: Get from referral system if needed
            referral_scans: totalScans,
            referral_signups: totalSignups
          };
        } catch (petError) {
          console.error('Error fetching data for user', profile.user_id, ':', petError);
          // Return customer data without pet count if pet query fails
          return {
            id: profile.id,
            user_id: profile.user_id,
            email: profile.email || '',
            first_name: profile.first_name || null,
            last_name: profile.last_name || null,
            full_name: profile.first_name && profile.last_name
              ? `${profile.first_name} ${profile.last_name}`
              : profile.first_name || profile.last_name || null,
            phone: profile.phone || null,
            is_registered: true,
            total_pets: 0,
            total_orders: 0,
            total_spent: 0,
            avg_order_value: 0,
            first_order_date: null,
            last_order_date: null,
            customer_status: profile.status || 'active',
            customer_segment: 'New',
            marketing_consent: false,
            email_verified: true,
            phone_verified: false,
            created_at: profile.created_at,
            updated_at: profile.updated_at,
            referred_by_partner_id: null,
            referral_scans: 0,
            referral_signups: 0
          };
        }
      })
    );

    console.log('Admin customers API: Processed', customersWithPets.length, 'customers with pet data');
    return NextResponse.json(customersWithPets);
  } catch (error) {
    console.error('Error fetching customers for admin:', error);
    return NextResponse.json(
      { error: 'Failed to fetch customers' },
      { status: 500 }
    );
  }
}