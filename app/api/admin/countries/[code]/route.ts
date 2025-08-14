import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function PATCH(
  request: NextRequest,
  { params }: { params: { code: string } }
) {
  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const countryCode = params.code;
    const updates = await request.json();

    // Validate the country code exists
    const { data: existingCountry, error: fetchError } = await supabase
      .from('countries')
      .select('code')
      .eq('code', countryCode)
      .single();

    if (fetchError || !existingCountry) {
      return NextResponse.json(
        { error: 'Country not found' },
        { status: 404 }
      );
    }

    // Update the country
    const { data, error } = await supabase
      .from('countries')
      .update(updates)
      .eq('code', countryCode)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);

  } catch (error) {
    console.error('Error updating country:', error);
    return NextResponse.json(
      { error: 'Failed to update country' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { code: string } }
) {
  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const countryCode = params.code;

    const { data, error } = await supabase
      .from('countries')
      .select('*')
      .eq('code', countryCode)
      .single();

    if (error) {
      if (error.code === 'PGRST116') { // Row not found
        return NextResponse.json(
          { error: 'Country not found' },
          { status: 404 }
        );
      }
      throw error;
    }

    return NextResponse.json(data);

  } catch (error) {
    console.error('Error getting country:', error);
    return NextResponse.json(
      { error: 'Failed to fetch country' },
      { status: 500 }
    );
  }
}