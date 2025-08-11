import { NextRequest, NextResponse } from 'next/server';
import { SupabaseService } from '@/lib/supabase';

const supabaseService = new SupabaseService();

export async function GET(request: NextRequest) {
  try {
    // TODO: Add admin authentication check
    
    console.log('Admin platform stats API: Fetching sharing platform analytics...');
    
    // Get platform sharing statistics from the view
    const { data: platformStats, error: platformError } = await supabaseService['supabase']
      .from('platform_sharing_breakdown')
      .select('*')
      .order('total_shares', { ascending: false });

    if (platformError) {
      console.error('Error fetching platform stats:', platformError);
      throw platformError;
    }

    // Get detailed breakdown by image and platform
    const { data: detailedStats, error: detailError } = await supabaseService['supabase']
      .from('platform_analytics')
      .select(`
        platform,
        total_platform_shares,
        last_shared_at,
        image_id,
        image_catalog (
          prompt_text,
          public_url,
          breed_id,
          theme_id,
          style_id
        )
      `)
      .order('total_platform_shares', { ascending: false })
      .limit(100); // Top 100 most shared items

    const response = {
      platformOverview: platformStats || [],
      detailedBreakdown: detailedStats || [],
      summary: {
        totalPlatforms: (platformStats || []).length,
        totalShares: (platformStats || []).reduce((sum: number, stat: any) => sum + stat.total_shares, 0),
        mostPopularPlatform: (platformStats || []).length > 0 ? platformStats[0] : null,
        lastActivity: (platformStats || []).reduce((latest: string | null, stat: any) => {
          if (!latest || (stat.last_activity && new Date(stat.last_activity) > new Date(latest))) {
            return stat.last_activity;
          }
          return latest;
        }, null)
      }
    };

    console.log('Admin platform stats API: Found', (platformStats || []).length, 'platforms');
    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching platform stats for admin:', error);
    return NextResponse.json(
      { error: 'Failed to fetch platform statistics' },
      { status: 500 }
    );
  }
}