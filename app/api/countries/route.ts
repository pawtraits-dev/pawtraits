import { NextRequest, NextResponse } from 'next/server';
import { AdminSupabaseService } from '@/lib/admin-supabase';

export async function GET(request: NextRequest) {
  try {
    const supabaseService = new AdminSupabaseService();
    
    // Get all supported countries
    const countries = await supabaseService.getCountries();
    
    if (!countries) {
      return NextResponse.json([]);
    }

    // Sort by display_order, then by name
    const sortedCountries = countries
      .filter(country => country.is_supported)
      .sort((a, b) => {
        if (a.display_order !== b.display_order) {
          return a.display_order - b.display_order;
        }
        return a.name.localeCompare(b.name);
      });

    return NextResponse.json(sortedCountries);
  } catch (error) {
    console.error('Error fetching countries:', error);
    return NextResponse.json(
      { error: 'Failed to fetch countries' },
      { status: 500 }
    );
  }
}