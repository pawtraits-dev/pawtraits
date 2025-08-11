import { NextRequest, NextResponse } from 'next/server';
import { SupabaseService } from '@/lib/supabase';
import type { PartnerCreate } from '@/lib/types';

const supabaseService = new SupabaseService();

export async function GET(request: NextRequest) {
  try {
    const partner = await supabaseService.getCurrentPartner();
    
    if (!partner) {
      return NextResponse.json(
        { error: 'Partner not found or not authenticated' },
        { status: 404 }
      );
    }

    return NextResponse.json(partner);
  } catch (error) {
    console.error('Error fetching partner:', error);
    return NextResponse.json(
      { error: 'Failed to fetch partner profile' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate required fields
    const requiredFields = ['email', 'first_name', 'last_name'];
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }

    // Create partner data with defaults
    const partnerData: PartnerCreate = {
      email: body.email,
      first_name: body.first_name,
      last_name: body.last_name,
      phone: body.phone || null,
      business_name: body.business_name || null,
      business_type: body.business_type || null,
      business_address: body.business_address || null,
      business_phone: body.business_phone || null,
      business_website: body.business_website || null,
      bio: body.bio || null,
      avatar_url: body.avatar_url || null,
      is_active: true,
      is_verified: false,
      onboarding_completed: false,
      payment_method: body.payment_method || null,
      payment_details: body.payment_details || null,
      notification_preferences: {
        email_commissions: true,
        email_referrals: true,
        sms_enabled: false,
        ...body.notification_preferences
      }
    };

    const partner = await supabaseService.createPartner(partnerData);

    return NextResponse.json(partner, { status: 201 });
  } catch (error) {
    console.error('Error creating partner:', error);
    
    // Handle specific database errors
    if (error instanceof Error) {
      if (error.message.includes('duplicate key')) {
        return NextResponse.json(
          { error: 'Email already registered' },
          { status: 409 }
        );
      }
      if (error.message.includes('Not authenticated')) {
        return NextResponse.json(
          { error: 'Authentication required to create partner account' },
          { status: 401 }
        );
      }
      if (error.message.includes('new row violates row-level security')) {
        return NextResponse.json(
          { error: 'Permission denied. Please ensure you are properly authenticated.' },
          { status: 403 }
        );
      }
      
      // Return the actual error message for debugging
      return NextResponse.json(
        { error: `Database error: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create partner account' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    
    const partner = await supabaseService.updateCurrentPartner(body);

    return NextResponse.json(partner);
  } catch (error) {
    console.error('Error updating partner:', error);
    
    if (error instanceof Error && error.message.includes('Not authenticated')) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update partner profile' },
      { status: 500 }
    );
  }
}