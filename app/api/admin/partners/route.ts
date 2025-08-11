import { NextRequest, NextResponse } from 'next/server';
import { SupabaseService } from '@/lib/supabase';

const supabaseService = new SupabaseService();

export async function GET(request: NextRequest) {
  try {
    // TODO: Add admin authentication check
    // For now, we'll allow access - in production, verify admin role
    
    console.log('Admin partners API: Fetching ONLY business partners (not admin users)...');
    
    // First try the view, fallback to direct query if view doesn't exist
    let { data, error } = await supabaseService['supabase']
      .from('admin_partner_overview')
      .select('*')
      .not('business_name', 'is', null) // Only partners with business information
      .order('created_at', { ascending: false });

    if (error && error.message.includes('does not exist')) {
      console.log('Admin partners API: View does not exist, falling back to direct query');
      
      // Fallback to direct partners table query - ONLY partners, not admin users
      const { data: partnerData, error: partnerError } = await supabaseService['supabase']
        .from('partners')
        .select(`
          id,
          email,
          first_name,
          last_name,
          business_name,
          business_type,
          approval_status,
          is_active,
          is_verified,
          created_at,
          last_login_at
        `)
        .not('business_name', 'is', null) // Ensure only entries with business_name (actual partners)
        .order('created_at', { ascending: false });

      if (partnerError) throw partnerError;

      // Get real referral and commission data for each partner
      const partnersWithData = [];
      
      if (partnerData) {
        for (const partner of partnerData.filter((p: any) => 
          p.business_name && 
          p.business_name.trim() !== '' &&
          p.business_type
        )) {
          // Get referral stats for this partner
          const { data: referralStats } = await supabaseService['supabase']
            .from('referrals')
            .select('id, status, commission_amount')
            .eq('partner_id', partner.id);
          
          const totalReferrals = referralStats?.length || 0;
          const successfulReferrals = referralStats?.filter((r: any) => r.status === 'purchased').length || 0;
          // Convert commission_amount from pence to pounds
          const totalCommissions = referralStats?.reduce((sum: number, r: any) => sum + ((r.commission_amount || 0) / 100), 0) || 0;
          
          partnersWithData.push({
            ...partner,
            full_name: `${partner.first_name || ''} ${partner.last_name || ''}`.trim(),
            approval_status: partner.approval_status || 'pending' as const,
            total_referrals: totalReferrals,
            successful_referrals: successfulReferrals,
            total_commissions: totalCommissions
          });
        }
      }
      
      data = partnersWithData;
    } else if (error) {
      throw error;
    }

    // Additional safety filter: ensure we only return actual business partners
    if (data) {
      data = data.filter((partner: any) => 
        // Verify this is actually a business partner
        partner.business_name && 
        partner.business_name.trim() !== '' &&
        // Exclude any entries that might be admin users accidentally in partners table
        !partner.email?.includes('@admin') && // Basic admin email pattern check
        !partner.email?.includes('admin@') &&
        // Ensure they have partner-specific fields
        partner.business_type
      );
    }

    console.log('Admin partners API: Found', data?.length || 0, 'partners (after filtering)');
    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Error fetching partners for admin:', error);
    return NextResponse.json(
      { error: 'Failed to fetch partners' },
      { status: 500 }
    );
  }
}