import { NextRequest, NextResponse } from 'next/server';
import { SupabaseService } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    // TODO: Add admin authentication check
    // For now, we'll allow access - in production, verify admin role

    console.log('Admin partners API: Fetching partners using SupabaseService...');

    const supabaseService = new SupabaseService();

    // Get all partners using proper service method
    const partners = await supabaseService.getAllPartners();

    if (!partners || partners.length === 0) {
      console.log('Admin partners API: No partners found');
      return NextResponse.json([]);
    }

    // Enhance partner data with referral analytics
    const partnersWithData = [];

    for (const partner of partners.filter((p: any) =>
      p.business_name &&
      p.business_name.trim() !== '' &&
      p.business_type &&
      !p.email?.includes('@admin') && // Basic admin email pattern check
      !p.email?.includes('admin@')
    )) {
      // Get referral analytics for this partner
      const analytics = await supabaseService.getPartnerReferralAnalytics(partner.id);

      const totalReferrals = analytics?.summary?.total_scans || 0;
      const successfulReferrals = analytics?.summary?.total_purchases || 0;
      const totalCommissions = analytics?.summary?.total_commissions || 0;
      const paidCommissions = 0; // TODO: Implement commission payment tracking
      const unpaidCommissions = totalCommissions - paidCommissions;

      partnersWithData.push({
        ...partner,
        full_name: `${partner.first_name || ''} ${partner.last_name || ''}`.trim(),
        approval_status: partner.approval_status || 'pending' as const,
        total_referrals: totalReferrals,
        successful_referrals: successfulReferrals,
        total_commissions: totalCommissions,
        paid_commissions: paidCommissions,
        unpaid_commissions: unpaidCommissions
      });
    }

    const data = partnersWithData;

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