import { NextRequest, NextResponse } from 'next/server';
import { serviceClient } from '@/lib/qr/server';
import { getRequester, canAccessCustomImage } from '@/lib/guest/access';

/**
 * POST /api/customers/custom-images/[id]/share  { channel: 'native' | 'copy' }
 * The owner (signed-in or the guest who made it) shared their portrait's link: counts it for
 * Admin > Customisations (a custom_image_events row and last_shared_at). Visits to the shared link are counted
 * separately in share_count by /share/custom/[shareToken].
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const channel = body?.channel === 'copy' ? 'copy' : 'native';

    const requester = await getRequester(request);
    const supabase = serviceClient();
    const { data: row } = await supabase
      .from('customer_custom_images')
      .select('id, customer_email, guest_session_id')
      .eq('id', id)
      .maybeSingle();
    if (!row || !canAccessCustomImage(row, requester)) {
      return NextResponse.json({ error: 'Custom image not found' }, { status: 404 });
    }

    await Promise.all([
      supabase.from('customer_custom_images').update({ last_shared_at: new Date().toISOString() }).eq('id', id),
      supabase.from('custom_image_events').insert({ custom_image_id: id, event: 'share', channel }),
    ]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('share tracking failed', error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
