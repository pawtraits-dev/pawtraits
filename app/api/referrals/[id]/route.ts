import { NextRequest, NextResponse } from 'next/server';
import { SupabaseService } from '@/lib/supabase';
import { generateReferralQR } from '@/lib/qr-code';

const supabaseService = new SupabaseService();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const referral = await supabaseService.getReferral(id);
    
    if (!referral) {
      return NextResponse.json(
        { error: 'Referral not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(referral);
  } catch (error) {
    console.error('Error fetching referral:', error);
    return NextResponse.json(
      { error: 'Failed to fetch referral' },
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
    const body = await request.json();
    
    // Validate email if provided
    if (body.client_email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(body.client_email)) {
        return NextResponse.json(
          { error: 'Invalid email format' },
          { status: 400 }
        );
      }
      body.client_email = body.client_email.toLowerCase().trim();
    }

    // Clean up text fields
    if (body.client_name) {
      body.client_name = body.client_name.trim();
    }
    if (body.client_phone) {
      body.client_phone = body.client_phone.trim() || null;
    }
    if (body.client_notes) {
      body.client_notes = body.client_notes.trim() || null;
    }

    const referral = await supabaseService.updateReferral(id, body);

    return NextResponse.json(referral);
  } catch (error) {
    console.error('Error updating referral:', error);
    return NextResponse.json(
      { error: 'Failed to update referral' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const success = await supabaseService.deleteReferral(id);
    
    if (!success) {
      return NextResponse.json(
        { error: 'Failed to delete referral' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting referral:', error);
    return NextResponse.json(
      { error: 'Failed to delete referral' },
      { status: 500 }
    );
  }
}