import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * GET /api/credit-costs
 * Returns feature credit costs configuration for customer-facing UI
 * No authentication required as these are public pricing settings
 */
export async function GET(request: NextRequest) {
  try {
    // Use service role for database operations
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Fetch feature credit costs from configuration
    const { data: featureCosts, error } = await supabaseAdmin
      .rpc('get_feature_credit_costs');

    if (error) {
      console.error('Error fetching feature credit costs:', error);
      // Return default costs if database fetch fails
      return NextResponse.json({
        base_variation_cost: 1,
        multi_animal_cost: 2,
        format_variation_cost: 1,
        outfit_variation_cost: 1
      });
    }

    const costs = featureCosts && featureCosts.length > 0 ? featureCosts[0] : {
      base_variation_cost: 1,
      multi_animal_cost: 2,
      format_variation_cost: 1,
      outfit_variation_cost: 1
    };

    return NextResponse.json(costs);

  } catch (error) {
    console.error('Credit costs API error:', error);
    // Return default costs on error
    return NextResponse.json({
      base_variation_cost: 1,
      multi_animal_cost: 2,
      format_variation_cost: 1,
      outfit_variation_cost: 1
    });
  }
}
