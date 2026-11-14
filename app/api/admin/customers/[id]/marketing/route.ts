/**
 * POST /api/admin/customers/[id]/marketing  { action: 'unsubscribe' }
 * Admin removes a customer from marketing email on request. An admin can NOT subscribe anyone:
 * only the person themselves can (a tick, the preferences page, or "Yes please").
 * [id] is the user_profiles id, as on the customer detail page.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, serviceClient } from '@/lib/qr/server';
import { unsubscribe } from '@/lib/marketing/preferences';
import { marketingStates } from '@/lib/marketing/admin';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  if (body?.action !== 'unsubscribe') return NextResponse.json({ error: 'Admins can only unsubscribe a customer' }, { status: 400 });
  const supabase = serviceClient();
  const { data: profile } = await supabase.from('user_profiles').select('email').eq('id', id).eq('user_type', 'customer').maybeSingle();
  if (!profile?.email) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
  try {
    await unsubscribe(supabase, { email: profile.email, source: 'admin' });
    const marketing = (await marketingStates(supabase, [profile.email])).get(String(profile.email).trim().toLowerCase()) ?? null;
    return NextResponse.json({ ok: true, marketing });
  } catch (e) {
    console.error('admin unsubscribe failed', e);
    return NextResponse.json({ error: 'Could not unsubscribe this customer. Has the email preferences migration been run?' }, { status: 500 });
  }
}
