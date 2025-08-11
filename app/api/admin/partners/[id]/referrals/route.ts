import { NextRequest, NextResponse } from 'next/server';
import { SupabaseService } from '@/lib/supabase';

const supabaseService = new SupabaseService();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // TODO: Add admin authentication check
    const { id } = await params;
    
    console.log('Admin referrals API: Fetching referrals for partner:', id);
    
    // Get referrals for the specified partner
    const { data: referrals, error } = await supabaseService['supabase']
      .from('referrals')
      .select('*')
      .eq('partner_id', id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching partner referrals:', error);
      throw error;
    }

    // Convert commission amounts from pence to pounds for display
    const convertedReferrals = referrals?.map((referral: any) => ({
      ...referral,
      commission_amount: referral.commission_amount ? referral.commission_amount / 100 : referral.commission_amount
    }));

    console.log('Admin referrals API: Found', referrals?.length || 0, 'referrals for partner', id);
    return NextResponse.json(convertedReferrals || []);
  } catch (error) {
    console.error('Error fetching partner referrals for admin:', error);
    return NextResponse.json(
      { error: 'Failed to fetch partner referrals' },
      { status: 500 }
    );
  }
}