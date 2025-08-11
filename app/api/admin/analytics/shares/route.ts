import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'overview';
    const platform = searchParams.get('platform');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    switch (type) {
      case 'overview':
        // Get overview statistics
        const [
          { count: totalShares },
          { count: totalAccounts },
          { data: platformBreakdown },
          { data: topImages },
          { data: reachData }
        ] = await Promise.all([
          // Total shares
          supabase
            .from('share_events')
            .select('*', { count: 'exact', head: true }),
          
          // Total unique social accounts
          supabase
            .from('social_accounts')
            .select('*', { count: 'exact', head: true }),
          
          // Platform breakdown
          supabase
            .from('share_events')
            .select('platform')
            .then(({ data }) => {
              const breakdown: Record<string, number> = {};
              data?.forEach(event => {
                breakdown[event.platform] = (breakdown[event.platform] || 0) + 1;
              });
              return { data: breakdown };
            }),
          
          // Top shared images
          supabase
            .from('image_catalog')
            .select('id, prompt_text, public_url, share_count')
            .gt('share_count', 0)
            .order('share_count', { ascending: false })
            .limit(10),
          
          // Total reach calculation
          supabase
            .from('social_accounts')
            .select('follower_count')
            .then(({ data }) => {
              const totalReach = data?.reduce((sum, account) => sum + (account.follower_count || 0), 0) || 0;
              return { data: totalReach };
            })
        ]);

        return NextResponse.json({
          totalShares: totalShares || 0,
          totalAccounts: totalAccounts || 0,
          totalReach: reachData || 0,
          platformBreakdown: platformBreakdown || {},
          topImages: topImages || []
        });

      case 'events':
        // Get share events with image details
        let eventsQuery = supabase
          .from('share_events')
          .select(`
            *,
            image:image_catalog(
              id,
              filename,
              public_url,
              prompt_text,
              description,
              share_count
            )
          `)
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);

        if (platform && platform !== 'all') {
          eventsQuery = eventsQuery.eq('platform', platform);
        }

        const { data: events, error: eventsError } = await eventsQuery;
        
        if (eventsError) throw eventsError;

        return NextResponse.json(events || []);

      case 'accounts':
        // Get social accounts
        let accountsQuery = supabase
          .from('social_accounts')
          .select('*')
          .order('total_shares', { ascending: false })
          .range(offset, offset + limit - 1);

        if (platform && platform !== 'all') {
          accountsQuery = accountsQuery.eq('platform', platform);
        }

        const { data: accounts, error: accountsError } = await accountsQuery;
        
        if (accountsError) throw accountsError;

        return NextResponse.json(accounts || []);

      case 'images':
        // Get image performance data
        const { data: imageStats, error: imageError } = await supabase
          .from('image_catalog')
          .select(`
            id,
            filename,
            public_url,
            prompt_text,
            description,
            share_count,
            last_shared_at,
            created_at
          `)
          .gt('share_count', 0)
          .order('share_count', { ascending: false })
          .range(offset, offset + limit - 1);

        if (imageError) throw imageError;

        return NextResponse.json(imageStats || []);

      default:
        return NextResponse.json(
          { error: 'Invalid analytics type' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Error in share analytics API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics data' },
      { status: 500 }
    );
  }
}