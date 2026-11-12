import { NextRequest, NextResponse } from 'next/server';
import { serviceClient } from '@/lib/qr/server';

/**
 * Public country list (country picker, delivery). Reads the table directly: the old
 * version went through AdminSupabaseService, whose relative fetch fails on the server,
 * so this route always answered [].
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const supportedOnly = searchParams.get('supportedOnly') === 'true';

    let query = serviceClient()
      .from('countries')
      .select('*')
      .order('display_order', { ascending: true })
      .order('name', { ascending: true });

    if (supportedOnly) {
      query = query.eq('is_supported', true);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Error fetching countries:', error);
    return NextResponse.json(
      { error: 'Failed to fetch countries' },
      { status: 500 }
    );
  }
}
