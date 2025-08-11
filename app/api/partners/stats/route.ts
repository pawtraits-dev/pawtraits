import { NextRequest, NextResponse } from 'next/server';
import { SupabaseService } from '@/lib/supabase';

const supabaseService = new SupabaseService();

export async function GET(request: NextRequest) {
  try {
    const stats = await supabaseService.getPartnerStats();
    
    if (!stats) {
      return NextResponse.json(
        { error: 'Partner stats not found or not authenticated' },
        { status: 404 }
      );
    }

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching partner stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch partner statistics' },
      { status: 500 }
    );
  }
}