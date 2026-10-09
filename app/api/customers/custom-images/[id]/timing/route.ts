import { NextRequest, NextResponse } from 'next/server';
import { serviceClient } from '@/lib/qr/server';
import { getRequester, canAccessCustomImage } from '@/lib/guest/access';

export const dynamic = 'force-dynamic';

const FIELDS = ['submit', 'waiting', 'image_load', 'total'] as const;

/**
 * POST /api/customers/custom-images/[id]/timing
 * The phone's view of how long a painting took (tap → on screen), saved beside the server's
 * step timings in generation_metadata.timings.client. Only the device or customer that made it.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const requester = await getRequester(request);
    if (!requester.user && !requester.guestId) return NextResponse.json({ ok: false }, { status: 404 });

    const body = await request.json().catch(() => ({}));
    const client: Record<string, number> = {};
    for (const f of FIELDS) {
      const v = Number(body?.[f]);
      if (Number.isFinite(v) && v >= 0 && v < 10 * 60 * 1000) client[f] = Math.round(v);
    }
    if (!client.total) return NextResponse.json({ ok: false }, { status: 400 });

    const supabase = serviceClient();
    const { data: row } = await supabase
      .from('customer_custom_images')
      .select('id, customer_email, guest_session_id, generation_metadata')
      .eq('id', id)
      .maybeSingle();
    if (!row || !canAccessCustomImage(row, requester)) return NextResponse.json({ ok: false }, { status: 404 });

    const meta = row.generation_metadata || {};
    if (meta.timings?.client) return NextResponse.json({ ok: true }); // first report wins
    await supabase
      .from('customer_custom_images')
      .update({ generation_metadata: { ...meta, timings: { ...(meta.timings || {}), client } } })
      .eq('id', id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('custom-image timing failed', error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
