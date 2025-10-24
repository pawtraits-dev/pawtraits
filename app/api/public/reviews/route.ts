import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import type { Review } from '@/lib/types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * GET /api/public/reviews
 *
 * Returns published reviews for public display (homepage carousel)
 *
 * Query params:
 * - limit: number of reviews to return (default: 20, max: 100)
 * - random: if true, returns random selection instead of newest first
 *
 * No authentication required
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get('limit');
    const randomParam = searchParams.get('random');

    // Parse and validate limit
    let limit = 20;
    if (limitParam) {
      const parsedLimit = parseInt(limitParam, 10);
      if (!isNaN(parsedLimit) && parsedLimit > 0 && parsedLimit <= 100) {
        limit = parsedLimit;
      }
    }

    const isRandom = randomParam === 'true';

    // Use public anon key (no authentication needed)
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    let query = supabase
      .from('reviews')
      .select('*')
      .eq('is_published', true);

    if (isRandom) {
      // Get random reviews using PostgreSQL ORDER BY random()
      // Note: This is fine for small datasets but can be slow for large ones
      // For production with large datasets, consider a different approach
      const { data: allPublished, error: countError } = await supabase
        .from('reviews')
        .select('id', { count: 'exact', head: true })
        .eq('is_published', true);

      if (countError) {
        throw countError;
      }

      // Fetch all and randomly select on server
      const { data: reviews, error } = await supabase
        .from('reviews')
        .select('*')
        .eq('is_published', true)
        .order('created_at', { ascending: false })
        .limit(Math.min(limit * 3, 100)); // Fetch more than needed for better randomness

      if (error) {
        throw error;
      }

      // Shuffle and take limit
      const shuffled = (reviews || [])
        .sort(() => Math.random() - 0.5)
        .slice(0, limit);

      return NextResponse.json({
        reviews: shuffled as Review[],
        count: shuffled.length,
      });

    } else {
      // Return newest first
      query = query.order('created_at', { ascending: false }).limit(limit);

      const { data: reviews, error } = await query;

      if (error) {
        throw error;
      }

      return NextResponse.json({
        reviews: reviews as Review[],
        count: reviews?.length || 0,
      });
    }

  } catch (error) {
    console.error('Error in GET /api/public/reviews:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reviews' },
      { status: 500 }
    );
  }
}
