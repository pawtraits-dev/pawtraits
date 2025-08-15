import { NextRequest, NextResponse } from 'next/server';
import { AdminSupabaseService } from '@/lib/admin-supabase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const supportedOnly = searchParams.get('supportedOnly');
    
    const supabaseService = new AdminSupabaseService();
    
    // Get countries from database
    const countries = await supabaseService.getCountries();
    
    if (!countries) {
      return NextResponse.json([]);
    }

    // Filter by supported status if requested
    let filteredCountries = countries;
    if (supportedOnly === 'true') {
      filteredCountries = countries.filter(country => country.is_supported);
    }

    // Sort by display_order, then by name
    const sortedCountries = filteredCountries.sort((a, b) => {
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