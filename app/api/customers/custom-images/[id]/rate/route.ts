import { NextRequest, NextResponse } from 'next/server';
import { serviceClient } from '@/lib/qr/server';
import { getRequester, canAccessCustomImage } from '@/lib/guest/access';

/** POST /api/customers/custom-images/[id]/rate  { rating: 1–5 } — signed-in owner or creating guest */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { rating } = await request.json();
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'Rating must be between 1 and 5' }, { status: 400 });
    }

    const requester = await getRequester(request);
    const supabase = serviceClient();
    const { data: customImage } = await supabase
      .from('customer_custom_images')
      .select('id, customer_email, guest_session_id')
      .eq('id', id)
      .maybeSingle();

    if (!customImage || !canAccessCustomImage(customImage, requester)) {
      return NextResponse.json({ error: 'Custom image not found' }, { status: 404 });
    }

    const { error } = await supabase.from('customer_custom_images').update({ rating }).eq('id', id);
    if (error) return NextResponse.json({ error: 'Failed to update rating' }, { status: 500 });
    return NextResponse.json({ success: true, rating });
  } catch (error) {
    console.error('rate failed', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
