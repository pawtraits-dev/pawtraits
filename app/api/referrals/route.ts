import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { SupabaseService } from '@/lib/supabase';
import { generateReferralQR } from '@/lib/qr-code';
import type { ReferralCreate } from '@/lib/types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const supabaseService = new SupabaseService();

// Helper function to create referral for a specific partner
async function createReferralForPartner(partnerId: string, referralData: {
  client_first_name: string;
  client_last_name: string;
  client_email: string;
  client_phone?: string | null;
  client_notes?: string | null;
  pet_name?: string | null;
  pet_breed_id?: string | null;
  pet_coat_id?: string | null;
  image_id?: string | null;
  referral_type?: string;
}) {
  // Get partner info for referral code generation
  const { data: partner, error: partnerError } = await supabase
    .from('partners')
    .select('business_name')
    .eq('id', partnerId)
    .single();

  if (partnerError || !partner) {
    throw new Error('Partner not found');
  }

  // Generate unique referral code
  const partnerPrefix = partner.business_name 
    ? partner.business_name.substring(0, 3).toUpperCase()
    : 'REF';
  const timestamp = Date.now().toString().slice(-6);
  const referralCode = `${partnerPrefix}${timestamp}`;

  // Debug: Log what we're sending to the database function
  const dbParams = {
    p_partner_id: partnerId,
    p_referral_code: referralCode,
    p_client_first_name: referralData.client_first_name,
    p_client_last_name: referralData.client_last_name,
    p_client_email: referralData.client_email,
    p_client_phone: referralData.client_phone,
    p_client_notes: referralData.client_notes,
    p_pet_name: referralData.pet_name,
    p_pet_breed_id: referralData.pet_breed_id,
    p_pet_coat_id: referralData.pet_coat_id,
    p_image_id: referralData.image_id,
    p_referral_type: referralData.referral_type,
  };
  console.log('Calling database function with:', JSON.stringify(dbParams, null, 2));

  // Use database function to create referral (bypasses RLS)
  const { data: referral, error } = await supabase
    .rpc('create_referral_for_partner', dbParams);

  if (error) {
    console.error('Error creating referral via function:', error);
    throw error;
  }

  return referral;
}

export async function GET(request: NextRequest) {
  try {
    // Get authorization header  
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('No auth header found, returning empty referrals');
      return NextResponse.json([]);
    }

    const token = authHeader.replace('Bearer ', '');

    // Create service role client to bypass RLS
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Get user from token
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.log('Auth error:', authError);
      return NextResponse.json([]);
    }

    console.log('Fetching referrals for user:', user.id);

    // First, check if this user exists as a partner
    const { data: partner, error: partnerError } = await supabase
      .from('partners')
      .select('id, business_name')
      .eq('id', user.id)
      .single();

    if (partnerError || !partner) {
      console.log('Partner not found for user:', user.id, partnerError);
      return NextResponse.json([]);
    }

    console.log('Found partner:', partner.business_name);

    // Get DIRECT referrals for this partner from customers table (unified system)
    // Only show customers where referral_type = 'PARTNER' and referrer_id = partner.id
    const { data: customerReferrals, error: customerError } = await supabase
      .from('customers')
      .select('id, email, first_name, last_name, referral_type, referrer_id, referral_code_used, referral_applied_at, created_at')
      .eq('referral_type', 'PARTNER')
      .eq('referrer_id', user.id)
      .order('created_at', { ascending: false });

    if (customerError) {
      console.error('Error fetching customer referrals:', customerError);
      return NextResponse.json([]);
    }

    console.log('Found direct customer referrals:', customerReferrals?.length || 0);

    // Transform customer data to match expected referral format for dashboard
    const processedReferrals = (customerReferrals || []).map(customer => {
      return {
        id: customer.id,
        client_first_name: customer.first_name,
        client_last_name: customer.last_name,
        client_email: customer.email,
        referral_code: customer.referral_code_used,
        status: 'accepted', // Customer has signed up
        created_at: customer.referral_applied_at || customer.created_at,
        // TODO: Add order and commission data when we implement order tracking
        order_count: 0,
        total_order_value: 0,
        total_commission_amount: 0,
        pending_commission: 0,
        paid_commission: 0
      };
    });

    if (processedReferrals && processedReferrals.length > 0) {
      console.log('Sample processed referral:', JSON.stringify(processedReferrals[0], null, 2));
    }

    return NextResponse.json(processedReferrals);
  } catch (error) {
    console.error('Error in referrals API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch referrals' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get authorization header  
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authorization required' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');

    // Get user from token
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Invalid authorization' },
        { status: 401 }
      );
    }

    const body = await request.json();
    
    // Debug: Log the incoming request body
    console.log('Incoming referral creation request:', JSON.stringify(body, null, 2));
    console.log('Pet fields in request:', {
      pet_name: body.pet_name,
      pet_breed_id: body.pet_breed_id,
      pet_coat_id: body.pet_coat_id
    });
    
    // Check if this is a Method 2 referral (image sharing without customer details)
    const isMethod2 = body.referral_type === 'image_share';
    
    // Validate required fields based on referral type
    if (isMethod2) {
      // Method 2: Only require image_id, allow empty customer details
      if (!body.image_id) {
        return NextResponse.json(
          { error: 'Missing required field: image_id for image share referral' },
          { status: 400 }
        );
      }
    } else {
      // Method 1: Traditional referral requires customer details
      const requiredFields = ['client_first_name', 'client_last_name', 'client_email'];
      for (const field of requiredFields) {
        if (!body[field]) {
          return NextResponse.json(
            { error: `Missing required field: ${field}` },
            { status: 400 }
          );
        }
      }

      // Validate email format for Method 1
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(body.client_email)) {
        return NextResponse.json(
          { error: 'Invalid email format' },
          { status: 400 }
        );
      }
    }

    // Skip duplicate checks for Method 2 (image sharing)
    if (!isMethod2) {
      // Only perform duplicate checks for Method 1 (traditional referrals)
      const clientEmail = body.client_email.toLowerCase().trim();
      
      // Check if customer already exists
      const { data: existingCustomer } = await supabase
        .from('customers')
        .select('id')
        .eq('email', clientEmail)
        .limit(1);

      if (existingCustomer && existingCustomer.length > 0) {
        return NextResponse.json(
          { error: 'This email address already has an account. Referrals are only for new customers.' },
          { status: 409 }
        );
      }

      // Check if email already has an active referral
      const { data: existingReferral } = await supabase
        .from('referrals')
        .select('id, status, expires_at')
        .eq('client_email', clientEmail)
        .in('status', ['pending', 'sent', 'viewed'])
        .limit(1);

      if (existingReferral && existingReferral.length > 0) {
        const referral = existingReferral[0];
        // Check if it's still active (not expired)
        if (!referral.expires_at || new Date(referral.expires_at) > new Date()) {
          return NextResponse.json(
            { error: 'This email address already has an active referral. Please wait for it to expire or be used before creating a new one.' },
            { status: 409 }
          );
        }
      }
    }

    // Prepare referral data based on type
    const referralData = isMethod2 ? {
      // Method 2: Image share referral with placeholder customer details
      client_first_name: '',
      client_last_name: '',
      client_email: '', // Empty initially
      client_phone: null,
      client_notes: `Shared image: ${body.image_id}`,
      pet_name: null,
      pet_breed_id: null,
      pet_coat_id: null,
      image_id: body.image_id, // Track which image was shared
      referral_type: 'image_share'
    } : {
      // Method 1: Traditional referral with customer details
      client_first_name: body.client_first_name.trim(),
      client_last_name: body.client_last_name.trim(),
      client_email: body.client_email.toLowerCase().trim(),
      client_phone: body.client_phone?.trim() || null,
      client_notes: body.client_notes?.trim() || null,
      pet_name: body.pet_name?.trim() || null,
      pet_breed_id: body.pet_breed_id || null,
      pet_coat_id: body.pet_coat_id || null,
      referral_type: 'traditional'
    };
    
    console.log('Prepared referral data for database:', JSON.stringify(referralData, null, 2));

    // Create referral directly without using the service method that requires getCurrentPartner
    const referral = await createReferralForPartner(user.id, referralData);

    // Generate QR code
    const qrResult = await generateReferralQR(referral.referral_code, {
      upload: true
    });

    // Update referral with QR code URL if successful using database function
    if (qrResult.qrCodeUrl) {
      const { data: updatedReferral, error: updateError } = await supabase
        .rpc('update_referral_qr_code', {
          p_referral_id: referral.id,
          p_qr_code_url: qrResult.qrCodeUrl
        });

      if (updateError) {
        console.error('Error updating QR code URL:', updateError);
        // Still return the referral even if QR update fails
      }
      
      return NextResponse.json({
        ...referral,
        qr_code_url: qrResult.qrCodeUrl
      }, { status: 201 });
    }

    // If QR generation failed, still return the referral but log the error
    if (qrResult.error) {
      console.warn('QR code generation failed:', qrResult.error);
    }

    return NextResponse.json(referral, { status: 201 });
  } catch (error) {
    console.error('Error creating referral:', error);
    
    // Handle specific database errors
    if (error instanceof Error) {
      if (error.message.includes('Not authenticated')) {
        return NextResponse.json(
          { error: 'Not authenticated as partner' },
          { status: 401 }
        );
      }
      if (error.message.includes('duplicate key')) {
        return NextResponse.json(
          { error: 'Client email already has an active referral' },
          { status: 409 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Failed to create referral' },
      { status: 500 }
    );
  }
}