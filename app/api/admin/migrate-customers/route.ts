import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    // Use service role key for admin operations
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    console.log('Migrating existing customers to user_profiles...');

    // Get all existing customers
    const { data: customers, error: customersError } = await supabase
      .from('customers')
      .select('*');

    if (customersError) {
      throw customersError;
    }

    if (!customers || customers.length === 0) {
      return NextResponse.json({ 
        message: 'No customers found to migrate',
        migrated: 0
      });
    }

    console.log('Found', customers.length, 'customers to migrate');

    let migrated = 0;
    const errors = [];

    // Create user_profiles for each customer
    for (const customer of customers) {
      try {
        // Create user profile using the create_user_profile function
        const { data: profile, error: profileError } = await supabase
          .rpc('create_user_profile', {
            p_user_id: customer.user_id,
            p_user_type: 'customer',
            p_first_name: customer.first_name,
            p_last_name: customer.last_name,
            p_email: customer.email,
            p_phone: customer.phone || null,
            p_customer_id: customer.id
          });

        if (profileError) {
          // Check if it's a duplicate key error (user already has profile)
          if (profileError.code === '23505') {
            console.log('User profile already exists for customer:', customer.email);
            continue;
          } else {
            throw profileError;
          }
        }

        console.log('Created user profile for customer:', customer.email);
        migrated++;

      } catch (error) {
        console.error('Error creating profile for customer', customer.email, ':', error);
        errors.push({
          customer_email: customer.email,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Also migrate existing partners
    const { data: partners, error: partnersError } = await supabase
      .from('partners')
      .select('*');

    if (!partnersError && partners && partners.length > 0) {
      console.log('Found', partners.length, 'partners to migrate');

      for (const partner of partners) {
        try {
          // Create user profile for partner
          const { data: profile, error: profileError } = await supabase
            .rpc('create_user_profile', {
              p_user_id: partner.id, // partners use their ID as user_id
              p_user_type: 'partner',
              p_first_name: partner.first_name,
              p_last_name: partner.last_name,
              p_email: partner.email,
              p_phone: partner.phone || null,
              p_partner_id: partner.id
            });

          if (profileError) {
            // Check if it's a duplicate key error
            if (profileError.code === '23505') {
              console.log('User profile already exists for partner:', partner.email);
              continue;
            } else {
              throw profileError;
            }
          }

          console.log('Created user profile for partner:', partner.email);
          migrated++;

        } catch (error) {
          console.error('Error creating profile for partner', partner.email, ':', error);
          errors.push({
            partner_email: partner.email,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
    }

    return NextResponse.json({ 
      success: true,
      message: `Migration completed. ${migrated} user profiles created.`,
      migrated,
      errors: errors.length > 0 ? errors : null
    });

  } catch (error) {
    console.error('Error migrating customers:', error);
    return NextResponse.json(
      { error: 'Failed to migrate customers: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    );
  }
}