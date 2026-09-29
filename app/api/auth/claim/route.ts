/**
 * POST /api/auth/claim  { token }
 * Exchanges the long-lived link from the "account ready" email for a real Supabase
 * session (fresh magic-link OTP verified server-side → session cookies), then unlocks the
 * guest's free download. POST-only so email link scanners (which only GET) can't consume it.
 */
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { serviceClient } from '@/lib/qr/server';
import { hashClaimToken } from '@/lib/guest/account';
import { claimEntitlements } from '@/lib/orders/entitlements';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const { token } = await request.json().catch(() => ({}));
  if (!token || typeof token !== 'string' || token.length < 20) {
    return NextResponse.json({ error: 'This link is not valid.' }, { status: 400 });
  }

  const admin = serviceClient();
  const { data: claim } = await admin
    .from('account_claim_tokens')
    .select('id, user_id, customer_id, email, expires_at, use_count, first_used_at')
    .eq('token_hash', hashClaimToken(token))
    .maybeSingle();

  if (!claim) return NextResponse.json({ error: 'This link is not valid.', code: 'INVALID' }, { status: 400 });
  if (new Date(claim.expires_at) < new Date()) {
    return NextResponse.json({ error: 'This link has expired — sign in with your email address instead.', code: 'EXPIRED', email: claim.email }, { status: 410 });
  }

  // Fresh one-time magic link, verified immediately on the server → session cookies set
  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({ type: 'magiclink', email: claim.email });
  const tokenHash = link?.properties?.hashed_token;
  if (linkErr || !tokenHash) {
    console.error('claim: generateLink failed', linkErr);
    return NextResponse.json({ error: 'We couldn’t sign you in just now — please try again.' }, { status: 500 });
  }
  const cookieStore = await cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore } as any);
  const { error: verifyErr } = await supabase.auth.verifyOtp({ type: 'magiclink', token_hash: tokenHash });
  if (verifyErr) {
    console.error('claim: verifyOtp failed', verifyErr);
    return NextResponse.json({ error: 'We couldn’t sign you in just now — please try again.' }, { status: 500 });
  }

  const now = new Date().toISOString();
  await admin.from('account_claim_tokens').update({
    first_used_at: claim.first_used_at ?? now, last_used_at: now, use_count: (claim.use_count ?? 0) + 1,
  }).eq('id', claim.id);

  let unlocked = 0;
  if (claim.customer_id) unlocked = await claimEntitlements(admin, claim.customer_id, claim.email);

  return NextResponse.json({ ok: true, unlocked, redirectTo: '/customer/downloads?welcome=1' });
}
